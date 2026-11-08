import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `setPasswordFromRecoverySession` — a porta que não pode abrir sem o link
 * =========================================================================
 * Grava a palavra-passe com a chave de serviço, por cima da regra do Supabase
 * que pede `aal2` a contas com 2FA. Por isso a única coisa que a separa de
 * "quem sabe a palavra-passe troca-a sem a 2FA" é verificar que a sessão
 * nasceu de um link do e-mail, há pouco. É isso que se testa.
 */

const updateUserById = vi.fn();
const getUserById = vi.fn();
const maybeSingle = vi.fn();

vi.mock("next-intl/server", () => ({ getTranslations: async () => (k: string) => k }));
vi.mock("@upm/db/server", () => ({
  createServiceClient: () => ({
    auth: { admin: { updateUserById, getUserById } },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
  }),
}));

const { RECOVERY_WINDOW_SECONDS, setPasswordFromRecoverySession } = await import("./staff-access");

const ID = "33333333-3333-4333-8333-333333333333";
const AGORA = 1_800_000_000;

beforeEach(() => {
  updateUserById.mockReset().mockResolvedValue({ error: null });
  getUserById.mockReset().mockResolvedValue({ data: { user: { email: "a@x.pt" } } });
  maybeSingle.mockReset().mockResolvedValue({ data: { id: ID, role: "admin", status: "active" } });
});

describe("setPasswordFromRecoverySession", () => {
  it("grava com a sessão do link (o Supabase marca-a `otp`), acabada de abrir", async () => {
    const amr = [{ method: "otp", timestamp: AGORA - 60 }];
    expect(await setPasswordFromRecoverySession({ sub: ID, amr }, "x", AGORA)).toBe("ok");
    const recovery = [{ method: "recovery", timestamp: AGORA }];
    expect(await setPasswordFromRecoverySession({ sub: ID, amr: recovery }, "x", AGORA)).toBe("ok");
    expect(updateUserById).toHaveBeenCalledTimes(2);
  });

  it("recusa uma sessão de quem entrou só com a palavra-passe", async () => {
    const amr = [{ method: "password", timestamp: AGORA }];
    expect(await setPasswordFromRecoverySession({ sub: ID, amr }, "x", AGORA)).toBe("not_recovery");
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("recusa a sessão do link depois da janela, e o `amr` sem data", async () => {
    const velha = [{ method: "otp", timestamp: AGORA - RECOVERY_WINDOW_SECONDS - 1 }];
    expect(await setPasswordFromRecoverySession({ sub: ID, amr: velha }, "x", AGORA)).toBe(
      "not_recovery",
    );
    expect(await setPasswordFromRecoverySession({ sub: ID, amr: ["otp"] }, "x", AGORA)).toBe(
      "not_recovery",
    );
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("recusa sem sessão, e recusa uma conta que não é da equipa", async () => {
    expect(await setPasswordFromRecoverySession(null, "x", AGORA)).toBe("not_recovery");
    maybeSingle.mockResolvedValue({ data: { id: ID, role: "owner", status: "active" } });
    const amr = [{ method: "otp", timestamp: AGORA }];
    expect(await setPasswordFromRecoverySession({ sub: ID, amr }, "x", AGORA)).toBe("not_recovery");
    expect(updateUserById).not.toHaveBeenCalled();
  });
});
