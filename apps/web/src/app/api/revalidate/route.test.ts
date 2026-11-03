import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({ revalidateTag: (tag: string) => revalidateTag(tag) }));

const { POST } = await import("./route");

const ID = "6caa58de-4fa2-4f2d-a76d-8a4c2ac1526b";

function pedido(corpo: unknown, autorizacao?: string): Request {
  return new Request("http://localhost/api/revalidate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(autorizacao ? { authorization: autorizacao } : {}),
    },
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
  });
}

describe("F2 · POST /api/revalidate", () => {
  beforeEach(() => {
    vi.stubEnv("SITE_REVALIDATE_SECRET", "s3gr3do");
    revalidateTag.mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("com o segredo, invalida as etiquetas pedidas", async () => {
    const r = await POST(pedido({ tags: ["listings", `listing:${ID}`] }, "Bearer s3gr3do"));
    expect(r.status).toBe(200);
    expect(revalidateTag.mock.calls.map((c) => c[0])).toEqual(["listings", `listing:${ID}`]);
  });

  it("sem segredo, ou com o errado, recusa e não toca na cache", async () => {
    expect((await POST(pedido({ tags: ["listings"] }))).status).toBe(401);
    expect((await POST(pedido({ tags: ["listings"] }, "Bearer outro"))).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("uma etiqueta fora da lista recusa o pedido inteiro", async () => {
    const r = await POST(pedido({ tags: ["listings", "tudo"] }, "Bearer s3gr3do"));
    expect(r.status).toBe(400);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("corpo que não é o esperado: 400", async () => {
    expect((await POST(pedido("não é json", "Bearer s3gr3do"))).status).toBe(400);
    expect((await POST(pedido({ tags: [] }, "Bearer s3gr3do"))).status).toBe(400);
  });

  it("sem SITE_REVALIDATE_SECRET configurado a rota não aceita ninguém", async () => {
    vi.stubEnv("SITE_REVALIDATE_SECRET", "");
    const r = await POST(pedido({ tags: ["listings"] }, "Bearer "));
    expect(r.status).toBe(503);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
