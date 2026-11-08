import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * O "Esqueci-me" do interno — só para admins, e sem o dizer (8 nov 2026)
 * =========================================================================
 * A resposta tem de ser a mesma em todos os casos, ou o formulário passa a
 * servir para descobrir quem é admin. O que muda é só o que se pede ao
 * `sendRecoveryLink`: que envie apenas se a conta for de um admin.
 */

const sendRecoveryLink = vi.fn();
const checkAuthRateLimit = vi.fn();
const recordAuthAttempt = vi.fn();

vi.mock("../../lib/staff-access", () => ({
  sendRecoveryLink: (...a: unknown[]) => sendRecoveryLink(...a),
}));
vi.mock("@upm/db/auth", async (original) => ({
  ...(await original<typeof import("@upm/db/auth")>()),
  checkAuthRateLimit: (...a: unknown[]) => checkAuthRateLimit(...a),
  recordAuthAttempt: (...a: unknown[]) => recordAuthAttempt(...a),
}));

const { requestAdminRecovery } = await import("./actions");

function pedido(email: string) {
  const form = new FormData();
  form.set("email", email);
  return requestAdminRecovery({}, form);
}

beforeEach(() => {
  sendRecoveryLink.mockReset().mockResolvedValue(true);
  checkAuthRateLimit.mockReset().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  recordAuthAttempt.mockReset().mockResolvedValue(undefined);
});

describe("requestAdminRecovery", () => {
  it("só pede o envio para admins", async () => {
    await pedido("Ana@Exemplo.PT");
    expect(sendRecoveryLink).toHaveBeenCalledWith("ana@exemplo.pt", { onlyIfRole: ["admin"] });
  });

  it("responde o mesmo quando envia e quando não envia", async () => {
    sendRecoveryLink.mockResolvedValueOnce(true);
    const enviado = await pedido("admin@exemplo.pt");
    sendRecoveryLink.mockResolvedValueOnce(false);
    const naoEnviado = await pedido("suporte@exemplo.pt");
    expect(enviado).toEqual({ sent: true });
    expect(naoEnviado).toEqual(enviado);
  });

  it("respeita o limite de tentativas, sem enviar", async () => {
    checkAuthRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 });
    const result = await pedido("admin@exemplo.pt");
    expect(result.error).toBeTruthy();
    expect(sendRecoveryLink).not.toHaveBeenCalled();
  });

  it("recusa um e-mail inválido, sem enviar", async () => {
    expect((await pedido("ana@")).error).toBeTruthy();
    expect(sendRecoveryLink).not.toHaveBeenCalled();
  });
});
