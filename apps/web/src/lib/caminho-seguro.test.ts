import { describe, expect, it } from "vitest";

import { caminhoSeguro } from "./caminho-seguro";

describe("caminhoSeguro — o `next` do link de e-mail não leva para fora", () => {
  it("aceita caminhos deste site", () => {
    expect(caminhoSeguro("/")).toBe("/");
    expect(caminhoSeguro("/recuperar-palavra-passe/confirmar")).toBe(
      "/recuperar-palavra-passe/confirmar",
    );
  });

  it("recusa o que o browser leria como outro site", () => {
    // Cada um destes, colado ao `origin`, saía do domínio.
    for (const alheio of [
      "@site-alheio.com",
      "//site-alheio.com",
      "/\\site-alheio.com",
      "https://site-alheio.com",
    ]) {
      const destino = new URL(`https://www.upropertymarket.pt${caminhoSeguro(alheio)}`);
      expect(destino.host).toBe("www.upropertymarket.pt");
    }
  });

  it("sem `next`, vai para a home", () => {
    expect(caminhoSeguro(null)).toBe("/");
    expect(caminhoSeguro("")).toBe("/");
  });
});
