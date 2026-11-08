import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Recuperação de acesso da equipa, pelo admin — as recusas (8 nov 2026)
 * =========================================================================
 * `resetStaffPassword` e `resetStaffTwoFactor` mexem no acesso de outras
 * pessoas com a chave de serviço, por isso a autorização é toda de cá: não há
 * RLS por trás de `auth.admin`. Cada recusa tem de acontecer **antes** de se
 * tocar na conta — é isso que os testes verificam, além da recusa em si.
 */

const getUser = vi.fn();
const maybeSingle = vi.fn();
const rpc = vi.fn();
const staffProfile = vi.fn();
const sendRecoveryLink = vi.fn();
const resetStaffMfa = vi.fn();

vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@upm/db/server", () => ({
  createClient: () => ({
    auth: { getUser },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
    rpc,
  }),
}));
vi.mock("../../../lib/staff-access", () => ({
  staffProfile: (...a: unknown[]) => staffProfile(...a),
  sendRecoveryLink: (...a: unknown[]) => sendRecoveryLink(...a),
  resetStaffMfa: (...a: unknown[]) => resetStaffMfa(...a),
}));

const { resetStaffPassword, resetStaffTwoFactor } = await import("./actions");

const ADMIN = "11111111-1111-4111-8111-111111111111";
const ALVO = "22222222-2222-4222-8222-222222222222";

function sessao(role: string | null, id = ADMIN) {
  getUser.mockResolvedValue({ data: { user: role ? { id } : null } });
  maybeSingle.mockResolvedValue({ data: role ? { role } : null });
}

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ error: null });
  staffProfile
    .mockReset()
    .mockResolvedValue({ id: ALVO, role: "support", status: "active", email: "s@x.pt" });
  sendRecoveryLink.mockReset().mockResolvedValue(true);
  resetStaffMfa.mockReset().mockResolvedValue(true);
  sessao("admin");
});

const acoes = [
  ["repor palavra-passe", resetStaffPassword, sendRecoveryLink],
  ["repor 2FA", resetStaffTwoFactor, resetStaffMfa],
] as const;

for (const [nome, acao, efeito] of acoes) {
  describe(nome, () => {
    it("um admin, sobre alguém da equipa, com o PIN: faz e regista", async () => {
      expect(await acao({ profileId: ALVO })).toEqual({ ok: true });
      expect(efeito).toHaveBeenCalledTimes(1);
      expect(rpc).toHaveBeenCalledWith("require_step_up");
      expect(rpc).toHaveBeenCalledWith(
        "write_audit_log",
        expect.objectContaining({ p_entity_id: ALVO }),
      );
    });

    it("recusa quem não é admin (suporte, marketing, cliente, sem sessão)", async () => {
      for (const role of ["support", "marketing", "owner", "buyer", null]) {
        sessao(role);
        const result = await acao({ profileId: ALVO });
        expect(result.ok, String(role)).toBeUndefined();
        expect(result.error, String(role)).toBeTruthy();
      }
      expect(efeito).not.toHaveBeenCalled();
    });

    it("recusa o próprio admin", async () => {
      const result = await acao({ profileId: ADMIN });
      expect(result.error).toBeTruthy();
      expect(efeito).not.toHaveBeenCalled();
    });

    it("recusa uma conta que não é da equipa", async () => {
      staffProfile.mockResolvedValue(null);
      const result = await acao({ profileId: ALVO });
      expect(result.error).toBeTruthy();
      expect(efeito).not.toHaveBeenCalled();
    });

    it("sem o PIN, pede-o e não faz nada", async () => {
      rpc.mockImplementation(async (nomeRpc: string) =>
        nomeRpc === "require_step_up"
          ? { error: { code: "P0001", message: "PIN", hint: "step_up_required" } }
          : { error: null },
      );
      const result = await acao({ profileId: ALVO });
      expect(result).toEqual({ needsStepUp: true });
      expect(efeito).not.toHaveBeenCalled();
    });

    it("recusa um id que não é um uuid, sem chegar a lado nenhum", async () => {
      expect((await acao({ profileId: "lixo" })).error).toBeTruthy();
      expect(staffProfile).not.toHaveBeenCalled();
      expect(efeito).not.toHaveBeenCalled();
    });
  });
}
