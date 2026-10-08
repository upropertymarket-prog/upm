import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Testes de `saveSeoPage` (P2-06 2.ª metade)
 * =========================================================================
 * A função SQL defende-se sozinha — é `security definer` e verifica o papel à
 * cabeça — mas isso só se vê com credenciais. Estes testes cobrem a camada de
 * cá, que corre sempre:
 *
 *  - **o papel**, que é verificado duas vezes de propósito. Um teste que
 *    confirme que uma sessão de proprietário não chega ao RPC é o que impede
 *    alguém de "simplificar" esta verificação por achar que a RLS já chega;
 *  - **cadeia vazia = não sobrepõe**: é a regra que atravessa as três camadas
 *    (aqui, na função SQL e no `buildMetadata`) e a única que, se partir,
 *    publica um título em branco no site;
 *  - as validações que recusam o que nunca é intencional — rota sem barra,
 *    canonical relativo —, e o silêncio deliberado sobre os 60/160 caracteres;
 *  - a falha do registo de auditoria, que **não** desfaz a gravação mas também
 *    não se cala.
 */

const rpc = vi.fn();
const getUser = vi.fn();
const maybeSingle = vi.fn();
const auditLog = vi.fn();
const revalidatePath = vi.fn();

vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));
vi.mock("@upm/db/audit", () => ({ writeAuditLog: (...args: unknown[]) => auditLog(...args) }));
vi.mock("@upm/db/server", () => ({
  createClient: () => ({
    auth: { getUser },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
    rpc,
  }),
}));

const { saveSeoPage } = await import("./actions");

/** A sessão por omissão destes testes: um admin autenticado. */
function signedInAs(role: string | null) {
  getUser.mockResolvedValue({ data: { user: role ? { id: "admin-1" } : null } });
  maybeSingle.mockResolvedValue({ data: role ? { role } : null });
}

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ error: null });
  auditLog.mockReset().mockResolvedValue("audit-1");
  revalidatePath.mockReset();
  getUser.mockReset();
  maybeSingle.mockReset();
  signedInAs("admin");
});

describe("autorização", () => {
  it("recusa sem sessão, sem chegar ao RPC", async () => {
    signedInAs(null);

    const result = await saveSeoPage({ route: "/", titleTag: "Olá" });

    expect(result).toEqual({ error: "Sem autorização." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("recusa um papel que não seja admin", async () => {
    signedInAs("owner");

    const result = await saveSeoPage({ route: "/", titleTag: "Olá" });

    expect(result).toEqual({ error: "Sem autorização." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("traduz o not_authorized que vem da função SQL", async () => {
    rpc.mockResolvedValue({ error: { hint: "not_authorized" } });

    const result = await saveSeoPage({ route: "/", titleTag: "Olá" });

    expect(result).toEqual({ error: "Sem autorização." });
  });
});

describe("validação", () => {
  it("recusa uma rota que não começa por barra", async () => {
    const result = await saveSeoPage({ route: "termos", titleTag: "Olá" });

    expect(result.error).toContain("tem de começar por /");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("aceita o registo de predefinições", async () => {
    const result = await saveSeoPage({ route: "*", titleTag: "UProperty Market" });

    expect(result.ok).toBe(true);
    expect(rpc.mock.calls[0]?.[1]).toMatchObject({ p_route: "*" });
  });

  it("recusa um canonical relativo, que apontaria ao domínio errado", async () => {
    const result = await saveSeoPage({ route: "/", canonical: "/termos" });

    expect(result.error).toContain("URL absoluto");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("recusa uma imagem que não é caminho nem URL", async () => {
    const result = await saveSeoPage({ route: "/", ogImage: "og/home.jpg" });

    expect(result.error).toContain("/public");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("NÃO recusa um título acima dos 60 caracteres — é conselho, não regra", async () => {
    const result = await saveSeoPage({ route: "/", titleTag: "x".repeat(90) });

    expect(result.ok).toBe(true);
    expect(rpc).toHaveBeenCalled();
  });
});

describe("campos vazios", () => {
  it("manda null em vez de cadeia vazia — vazio não sobrepõe", async () => {
    await saveSeoPage({ route: "/", titleTag: "  ", metaDescription: "", ogTitle: "   " });

    expect(rpc.mock.calls[0]?.[1]).toMatchObject({
      p_title_tag: null,
      p_meta_description: null,
      p_og_title: null,
    });
  });

  it("apara os espaços à volta do que foi escrito", async () => {
    await saveSeoPage({ route: "/", titleTag: "  Início  " });

    expect(rpc.mock.calls[0]?.[1]).toMatchObject({ p_title_tag: "Início" });
  });

  it("deixa os booleanos por definir quando não vêm", async () => {
    await saveSeoPage({ route: "/", titleTag: "Início" });

    expect(rpc.mock.calls[0]?.[1]).toMatchObject({
      p_og_same_as_page: null,
      p_noindex: null,
    });
  });

  it("passa os booleanos quando vêm, incluindo `false`", async () => {
    await saveSeoPage({ route: "/", ogSameAsPage: false, noindex: false });

    expect(rpc.mock.calls[0]?.[1]).toMatchObject({
      p_og_same_as_page: false,
      p_noindex: false,
    });
  });
});

describe("auditoria", () => {
  it("regista a alteração com a rota como entidade", async () => {
    await saveSeoPage({ route: "/termos", titleTag: "Termos" });

    expect(auditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "seo.updated",
        entity: "seo_pages",
        entityId: "/termos",
      }),
    );
  });

  it("avisa quando o registo falha, mas não desfaz a gravação", async () => {
    auditLog.mockRejectedValue(new Error("rls"));

    const result = await saveSeoPage({ route: "/", titleTag: "Início" });

    expect(result.ok).toBe(true);
    expect(result.notice).toContain("registo de auditoria falhou");
  });
});

describe("erro de escrita", () => {
  it("não revela o motivo de um erro inesperado", async () => {
    rpc.mockResolvedValue({ error: { hint: "something_else" } });

    const result = await saveSeoPage({ route: "/", titleTag: "Início" });

    expect(result).toEqual({ error: "Não foi possível guardar o SEO." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
