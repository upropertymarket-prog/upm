import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Acesso da equipa, pelo admin — as recusas (8 e 20 nov 2026)
 * =========================================================================
 * `setStaffPassword` e `resetStaffTwoFactor` mexem no acesso de outras
 * pessoas com a chave de serviço, por isso a autorização é toda de cá: não há
 * RLS por trás de `auth.admin`. Cada recusa tem de acontecer **antes** de se
 * tocar na conta — é isso que os testes verificam, além da recusa em si.
 */

const getUser = vi.fn();
const maybeSingle = vi.fn();
const rpc = vi.fn();
const staffProfile = vi.fn();
const isPasswordPwned = vi.fn();
const resetStaffMfa = vi.fn();

vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@upm/db/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@upm/db/auth")>()),
  isPasswordPwned: (...a: unknown[]) => isPasswordPwned(...a),
}));
vi.mock("@upm/db/server", () => ({
  createClient: () => ({
    auth: { getUser },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
    rpc,
  }),
}));
const staffRecordCsv = vi.fn();
const staffExitBlockers = vi.fn();
const recordExportedRecently = vi.fn();
const deleteStaffUser = vi.fn();
vi.mock("../../../lib/staff-access", () => ({
  staffProfile: (...a: unknown[]) => staffProfile(...a),
  resetStaffMfa: (...a: unknown[]) => resetStaffMfa(...a),
  staffRecordCsv: (...a: unknown[]) => staffRecordCsv(...a),
  staffExitBlockers: (...a: unknown[]) => staffExitBlockers(...a),
  recordExportedRecently: (...a: unknown[]) => recordExportedRecently(...a),
  deleteStaffUser: (...a: unknown[]) => deleteStaffUser(...a),
}));

const { setStaffPassword, resetStaffTwoFactor, exportStaffRecord, deleteStaffAccount } =
  await import("./actions");

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
  isPasswordPwned.mockReset().mockResolvedValue(false);
  resetStaffMfa.mockReset().mockResolvedValue(true);
  staffRecordCsv.mockReset().mockResolvedValue("origem,data\r\nconta,2026");
  staffExitBlockers.mockReset().mockResolvedValue({ openLeads: 0, mailboxes: 0 });
  recordExportedRecently.mockReset().mockResolvedValue(true);
  deleteStaffUser.mockReset().mockResolvedValue(true);
  sessao("admin");
});

const SUSPENSO = { id: ALVO, role: "support", status: "suspended", email: "s@x.pt" };

const acoes = [
  ["repor 2FA", resetStaffTwoFactor, resetStaffMfa, null],
  ["descarregar o registo de quem sai", exportStaffRecord, staffRecordCsv, SUSPENSO],
  ["eliminar a conta de quem sai", deleteStaffAccount, deleteStaffUser, SUSPENSO],
] as const;

for (const [nome, acao, efeito, alvo] of acoes) {
  describe(nome, () => {
    beforeEach(() => {
      if (alvo) staffProfile.mockResolvedValue(alvo);
    });

    it("um admin, sobre alguém da equipa, com o PIN: faz e regista", async () => {
      expect(await acao({ profileId: ALVO })).toMatchObject({ ok: true });
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

/**
 * A palavra-passe da equipa, pelo admin (20 nov 2026)
 * =========================================================================
 * Quem escreve é `admin_set_staff_password`, que repete as recusas na base e
 * regista no `audit_log`. Aqui verifica-se que cada recusa acontece antes de
 * a palavra-passe sair para a base — e que ela só sai para lá.
 */
describe("mudar a palavra-passe de alguém da equipa", () => {
  const NOVA = "Nova-palavra-passe-2026";
  const chamouAEscrita = () =>
    rpc.mock.calls.some(([nomeRpc]) => nomeRpc === "admin_set_staff_password");

  it("um admin, sobre alguém da equipa ativo, com o PIN: grava pela base", async () => {
    expect(await setStaffPassword({ profileId: ALVO, password: NOVA })).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("require_step_up");
    expect(rpc).toHaveBeenCalledWith("admin_set_staff_password", {
      p_profile_id: ALVO,
      p_password: NOVA,
    });
  });

  it("recusa quem não é admin (suporte, marketing, cliente, sem sessão)", async () => {
    for (const role of ["support", "marketing", "owner", "buyer", null]) {
      sessao(role);
      const result = await setStaffPassword({ profileId: ALVO, password: NOVA });
      expect(result.ok, String(role)).toBeUndefined();
      expect(result.error, String(role)).toBeTruthy();
    }
    expect(chamouAEscrita()).toBe(false);
  });

  it("recusa o próprio admin: a sua muda-a o outro", async () => {
    expect((await setStaffPassword({ profileId: ADMIN, password: NOVA })).error).toBeTruthy();
    expect(chamouAEscrita()).toBe(false);
  });

  it("recusa uma conta que não é da equipa, e uma suspensa", async () => {
    staffProfile.mockResolvedValue(null);
    expect((await setStaffPassword({ profileId: ALVO, password: NOVA })).error).toBeTruthy();
    staffProfile.mockResolvedValue(SUSPENSO);
    expect((await setStaffPassword({ profileId: ALVO, password: NOVA })).error).toBeTruthy();
    expect(chamouAEscrita()).toBe(false);
  });

  it("sem o PIN, pede-o e não grava", async () => {
    rpc.mockImplementation(async (nomeRpc: string) =>
      nomeRpc === "require_step_up"
        ? { error: { code: "42501", message: "PIN", hint: "step_up_required" } }
        : { error: null },
    );
    expect(await setStaffPassword({ profileId: ALVO, password: NOVA })).toEqual({
      needsStepUp: true,
    });
    expect(chamouAEscrita()).toBe(false);
  });

  it("recusa uma palavra-passe curta, longa ou de uma fuga conhecida", async () => {
    expect((await setStaffPassword({ profileId: ALVO, password: "curta" })).error).toBeTruthy();
    expect(
      (await setStaffPassword({ profileId: ALVO, password: "x".repeat(73) })).error,
    ).toBeTruthy();
    isPasswordPwned.mockResolvedValue(true);
    expect(await setStaffPassword({ profileId: ALVO, password: NOVA })).toEqual({ pwned: true });
    expect(chamouAEscrita()).toBe(false);
  });

  it("se a base recusar, diz que falhou — sem ecoar a palavra-passe", async () => {
    rpc.mockImplementation(async (nomeRpc: string) =>
      nomeRpc === "admin_set_staff_password"
        ? { error: { code: "42501", message: "Sem permissão" } }
        : { error: null },
    );
    const result = await setStaffPassword({ profileId: ALVO, password: NOVA });
    expect(result.ok).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain(NOVA);
  });
});

/**
 * A saída da equipa (8 nov 2026): o que só estas duas pedem. Primeiro
 * suspende-se; a eliminação pede ainda o trabalho passado e o registo
 * descarregado — porque, depois dela, a base deixa de saber quem fez o quê.
 */
describe("saída da equipa", () => {
  beforeEach(() => {
    staffProfile.mockResolvedValue(SUSPENSO);
  });

  it("recusa as duas a uma conta que ainda está ativa", async () => {
    staffProfile.mockResolvedValue({ ...SUSPENSO, status: "active" });
    expect(await exportStaffRecord({ profileId: ALVO })).toEqual({ notSuspended: true });
    expect(await deleteStaffAccount({ profileId: ALVO })).toEqual({ notSuspended: true });
    expect(staffRecordCsv).not.toHaveBeenCalled();
    expect(deleteStaffUser).not.toHaveBeenCalled();
  });

  it("não elimina com trabalho ainda atribuído, e diz qual", async () => {
    staffExitBlockers.mockResolvedValue({ openLeads: 3, mailboxes: 1 });
    expect(await deleteStaffAccount({ profileId: ALVO })).toEqual({
      blockers: { openLeads: 3, mailboxes: 1 },
    });
    expect(deleteStaffUser).not.toHaveBeenCalled();
  });

  it("não elimina sem o registo descarregado", async () => {
    recordExportedRecently.mockResolvedValue(false);
    expect(await deleteStaffAccount({ profileId: ALVO })).toEqual({ needsExport: true });
    expect(deleteStaffUser).not.toHaveBeenCalled();
  });

  it("regista a eliminação antes de eliminar, e sem nome nem e-mail", async () => {
    const ordem: string[] = [];
    rpc.mockImplementation(async (nomeRpc: string) => {
      ordem.push(nomeRpc);
      return { error: null };
    });
    deleteStaffUser.mockImplementation(async () => {
      ordem.push("delete");
      return true;
    });
    expect(await deleteStaffAccount({ profileId: ALVO })).toEqual({ ok: true });
    expect(ordem).toEqual(["require_step_up", "write_audit_log", "delete"]);
    expect(rpc).toHaveBeenCalledWith("write_audit_log", {
      p_action: "staff.account_deleted",
      p_entity: "profiles",
      p_entity_id: ALVO,
      p_diff: { role: "support" },
    });
  });

  it("se o registo da eliminação falhar, não elimina", async () => {
    rpc.mockImplementation(async (nomeRpc: string) =>
      nomeRpc === "write_audit_log" ? { error: { message: "x" } } : { error: null },
    );
    expect((await deleteStaffAccount({ profileId: ALVO })).error).toBeTruthy();
    expect(deleteStaffUser).not.toHaveBeenCalled();
  });

  it("o registo devolve o CSV e fica no audit_log", async () => {
    const result = await exportStaffRecord({ profileId: ALVO });
    expect(result.csv).toContain("conta");
    expect(rpc).toHaveBeenCalledWith(
      "write_audit_log",
      expect.objectContaining({ p_action: "staff.record_export", p_entity_id: ALVO }),
    );
  });
});
