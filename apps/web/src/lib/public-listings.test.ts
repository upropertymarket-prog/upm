import { describe, expect, it } from "vitest";

import { listingIdFromSlug, listingSlug } from "./public-listings";

/**
 * Testes do slug público (P2-05)
 * =========================================================================
 * O slug é o contrato de URL do Market público: é o que fica em links
 * partilhados, em marcadores e no índice do Google. Se a resolução partir, as
 * fichas deixam de abrir — e parte em silêncio, porque um slug inválido dá
 * 404, que é indistinguível de um imóvel removido.
 *
 * O que está aqui coberto é a ida e volta (`listingSlug` → `listingIdFromSlug`)
 * e os casos que fazem a forma do slug importar: títulos com acentos, com
 * pontuação, vazios, e títulos que contenham eles próprios algo parecido com
 * um id.
 *
 * As leituras à base de dados não são testadas aqui — precisam de credenciais
 * e vivem em `packages/db`. O que estas funções têm de próprio é a forma do
 * URL, e isso testa-se sem rede.
 */

const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("listingSlug", () => {
  it("junta o título em kebab ao id", () => {
    expect(listingSlug({ id: ID, title: "Apartamento T2 no Porto" })).toBe(
      `apartamento-t2-no-porto-${ID}`,
    );
  });

  it("tira os acentos, que não pertencem a um URL", () => {
    expect(listingSlug({ id: ID, title: "Moradia em São João da Madeira" })).toBe(
      `moradia-em-sao-joao-da-madeira-${ID}`,
    );
  });

  it("colapsa pontuação e espaços num hífen só", () => {
    expect(listingSlug({ id: ID, title: "T3  —  Remodelado!! (2024)" })).toBe(
      `t3-remodelado-2024-${ID}`,
    );
  });

  it("devolve só o id quando o título está vazio", () => {
    // O caso de staging: os 23 imóveis de teste têm `title` vazio.
    expect(listingSlug({ id: ID, title: "" })).toBe(ID);
    expect(listingSlug({ id: ID, title: null })).toBe(ID);
    expect(listingSlug({ id: ID, title: "   " })).toBe(ID);
  });

  it("devolve só o id quando o título não tem nenhum caractere utilizável", () => {
    expect(listingSlug({ id: ID, title: "!!! ---" })).toBe(ID);
  });

  it("não deixa o prefixo crescer sem limite", () => {
    const slug = listingSlug({ id: ID, title: "palavra ".repeat(40) });
    // 80 do prefixo + hífen + 36 do uuid, no máximo.
    expect(slug.length).toBeLessThanOrEqual(80 + 1 + 36);
    expect(slug.endsWith(ID)).toBe(true);
    // E nunca termina o prefixo num hífen solto antes do id.
    expect(slug).not.toContain("--");
  });
});

describe("listingIdFromSlug", () => {
  it("faz a volta completa de qualquer título", () => {
    for (const title of [
      "Apartamento T2 no Porto",
      "Moradia em São João da Madeira",
      "T3  —  Remodelado!! (2024)",
      "",
      "palavra ".repeat(40),
    ]) {
      expect(listingIdFromSlug(listingSlug({ id: ID, title }))).toBe(ID);
    }
  });

  it("aceita um slug que seja só o id", () => {
    expect(listingIdFromSlug(ID)).toBe(ID);
  });

  it("normaliza o id para minúsculas", () => {
    expect(listingIdFromSlug(`casa-${ID.toUpperCase()}`)).toBe(ID);
  });

  it("recusa um slug sem id no fim", () => {
    expect(listingIdFromSlug("apartamento-t2-no-porto")).toBeNull();
    expect(listingIdFromSlug("")).toBeNull();
    // Um id truncado não é um id: resolvê-lo por aproximação abriria a ficha
    // errada.
    expect(listingIdFromSlug(ID.slice(0, 30))).toBeNull();
  });

  it("recusa um id com a forma certa mas caracteres inválidos", () => {
    expect(listingIdFromSlug("casa-zzzzzzzz-d9cb-469f-a165-70867728950e")).toBeNull();
  });

  it("não se engana com um título que pareça um id", () => {
    // O id real está no fim; o do título fica onde está e é ignorado.
    const other = "11111111-2222-3333-4444-555555555555";
    expect(listingIdFromSlug(`imovel-${other}-${ID}`)).toBe(ID);
  });
});
