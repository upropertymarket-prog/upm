import { afterEach, describe, expect, it, vi } from "vitest";

import {
  invalidarCacheDoSite,
  isSiteCacheTag,
  listingTag,
  segredoConfere,
  seoTag,
} from "./site-cache";

const ID = "6caa58de-4fa2-4f2d-a76d-8a4c2ac1526b";

describe("F2 · etiquetas que o www aceita invalidar", () => {
  it("aceita as da lista fechada e as formas com identificador", () => {
    for (const tag of [
      "listings",
      "launch-mode",
      "public-plans",
      listingTag(ID),
      seoTag("/precos", "pt"),
    ]) {
      expect(isSiteCacheTag(tag), tag).toBe(true);
    }
  });

  it("recusa o que não é dela — o segredo não abre a cache inteira", () => {
    for (const tag of [
      "",
      "listing:",
      "listing:nao-e-uuid",
      "listing:6CAA58DE-4FA2-4F2D-A76D-8A4C2AC1526B ",
      "seo:fr:/precos",
      "seo:pt:precos",
      "seo:pt:/../../etc",
      "qualquer-outra",
    ]) {
      expect(isSiteCacheTag(tag), tag).toBe(false);
    }
  });
});

describe("F2 · o segredo", () => {
  it("só confere com o Bearer exato, e nunca sem segredo configurado", () => {
    expect(segredoConfere("Bearer abc", "abc")).toBe(true);
    expect(segredoConfere("Bearer abcd", "abc")).toBe(false);
    expect(segredoConfere("abc", "abc")).toBe(false);
    expect(segredoConfere(null, "abc")).toBe(false);
    expect(segredoConfere("Bearer ", "")).toBe(false);
    expect(segredoConfere("Bearer abc", undefined)).toBe(false);
  });
});

describe("F2 · invalidarCacheDoSite nunca atira", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("manda só as etiquetas válidas, com o segredo, ao www", async () => {
    vi.stubEnv("SITE_REVALIDATE_SECRET", "s3gr3do");
    vi.stubEnv("WEB_URL", "http://localhost:4300");
    const fetch = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetch);

    await expect(invalidarCacheDoSite(["listings", "inventada", listingTag(ID)])).resolves.toBe(
      true,
    );
    const [url, init] = fetch.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe("http://localhost:4300/api/revalidate");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer s3gr3do");
    expect(JSON.parse(String(init.body))).toEqual({ tags: ["listings", listingTag(ID)] });
  });

  it("com o www em baixo devolve false, não atira — a decisão já está gravada", async () => {
    vi.stubEnv("SITE_REVALIDATE_SECRET", "s3gr3do");
    vi.stubEnv("WEB_URL", "http://localhost:4300");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new Error("ECONNREFUSED"))),
    );
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(invalidarCacheDoSite(["listings"])).resolves.toBe(false);
    expect(erro).toHaveBeenCalled();
  });

  it("sem segredo não chama ninguém, e di-lo", async () => {
    vi.stubEnv("SITE_REVALIDATE_SECRET", "");
    vi.stubEnv("WEB_URL", "http://localhost:4300");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(invalidarCacheDoSite(["listings"])).resolves.toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    expect(erro).toHaveBeenCalled();
  });
});
