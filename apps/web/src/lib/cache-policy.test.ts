import { describe, expect, it } from "vitest";

import { sharedCacheControl } from "./cache-policy";

/**
 * A política de cache partilhada (12 §10.4).
 *
 * A metade importante destes testes é a que devolve `null`. Guardar numa cache
 * partilhada uma página que não devia é a falha mais grave que uma cache sabe
 * produzir — servir a página de alguém a outra pessoa — e, ao contrário de
 * quase tudo o resto, não dá erro nenhum: dá conteúdo errado, a quem calhar,
 * durante o tempo que o `s-maxage` disser.
 */
describe("o que PODE ser partilhado", () => {
  it("a home e o catálogo", () => {
    for (const caminho of ["/", "/propriedades", "/en", "/en/properties"]) {
      expect(sharedCacheControl(caminho)).toContain("s-maxage=60");
    }
  });

  it("o detalhe de um anúncio, por mais tempo", () => {
    for (const caminho of ["/propriedades/casa-no-porto-abc123", "/en/properties/flat-abc123"]) {
      expect(sharedCacheControl(caminho)).toContain("s-maxage=300");
    }
  });

  it("os textos legais", () => {
    for (const caminho of ["/termos", "/privacidade", "/en/terms", "/en/privacy"]) {
      expect(sharedCacheControl(caminho)).toContain("s-maxage=300");
    }
  });

  it("sempre com `stale-while-revalidate` — é o que aguenta o pico", () => {
    expect(sharedCacheControl("/propriedades")).toContain("stale-while-revalidate");
  });

  it("e sempre com `max-age=0`, para o browser continuar a perguntar", () => {
    // `s-maxage` é para a borda. Sem `max-age=0`, o browser de cada pessoa
    // guardava a página e deixava de ver mudanças durante minutos.
    expect(sharedCacheControl("/")).toContain("max-age=0");
  });
});

describe("o que NÃO pode — e é esta a metade que conta", () => {
  it("tudo o que tem formulário ou identidade fica de fora", () => {
    for (const caminho of [
      "/entrar",
      "/en/sign-in",
      "/criar-conta",
      "/recuperar-palavra-passe",
      "/pre-inscricao",
      "/pre-inscricao/confirmar",
      "/auth/confirm",
    ]) {
      expect(sharedCacheControl(caminho)).toBeNull();
    }
  });

  it("um caminho que ninguém previu também fica de fora", () => {
    // Lista branca: esquecer de acrescentar custa desempenho, esquecer de
    // excluir custa uma fuga. O erro cai do lado certo.
    for (const caminho of ["/rota-nova", "/en/whatever", "/propriedades/abc/editar"]) {
      expect(sharedCacheControl(caminho)).toBeNull();
    }
  });

  it("o prefixo de idioma não abre portas que não existem", () => {
    expect(sharedCacheControl("/pt/entrar")).toBeNull();
    expect(sharedCacheControl("/en/entrar")).toBeNull();
  });
});

describe("as duas línguas caem na mesma regra", () => {
  it("com `as-needed`, o português não leva prefixo e o inglês leva", () => {
    expect(sharedCacheControl("/propriedades")).toBe(sharedCacheControl("/en/properties"));
    expect(sharedCacheControl("/")).toBe(sharedCacheControl("/en"));
  });

  it("um idioma inventado não tira o prefixo", () => {
    // `/fr/propriedades` não é uma rota nossa; não deve cair na regra do
    // catálogo só porque se parece com ela.
    expect(sharedCacheControl("/fr/propriedades")).toBeNull();
  });
});
