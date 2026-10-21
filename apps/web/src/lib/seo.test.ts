import { describe, expect, it } from "vitest";

import { buildMetadata, localizedPath, type RouteSeo } from "./seo";

/**
 * O que estes testes guardam é a falha que custou nove meses: o site trocava de
 * idioma em toda a interface e os metadados ficavam em português. Não houve
 * erro, nem aviso, nem portão vermelho — simplesmente ninguém reparou, porque
 * um título errado no separador do browser não se parece com um defeito.
 *
 * Por isso cada caso aqui é um sítio onde o idioma se pode perder em silêncio,
 * e não uma repetição da implementação.
 */
const rota: RouteSeo = {
  pt: {
    pageName: "Termos",
    titleTag: "Termos e Condições · UProperty Market",
    metaDescription: "Os Termos e Condições da plataforma.",
  },
  en: {
    pageName: "Terms",
    titleTag: "Terms and Conditions · UProperty Market",
    metaDescription: "The platform's Terms and Conditions.",
  },
};

/** O molde da rota, como o `buildMetadata` o espera desde 21 out 2026. */
const termos = { pathname: "/termos" } as const;

describe("buildMetadata — idioma", () => {
  it("usa o bloco do idioma pedido", () => {
    expect(buildMetadata(rota, termos, "en").title).toBe("Terms and Conditions · UProperty Market");
    expect(buildMetadata(rota, termos, "pt").title).toBe("Termos e Condições · UProperty Market");
  });

  it("marca o og:locale com o idioma da página, e não com um valor fixo", () => {
    // Era `locale: "pt_PT"` escrito à mão. Uma partilha de uma página em
    // inglês anunciava-se como portuguesa.
    expect(buildMetadata(rota, termos, "en").openGraph?.locale).toBe("en_GB");
    expect(buildMetadata(rota, termos, "pt").openGraph?.locale).toBe("pt_PT");
  });

  it("pede o cartão OG de omissão no idioma da página", () => {
    // O `lang` tem de ir no URL: um scraper de Open Graph não manda cookies, e
    // sem o parâmetro o cartão saía sempre em português.
    const en = buildMetadata(rota, termos, "en").openGraph?.images;
    const pt = buildMetadata(rota, termos, "pt").openGraph?.images;
    expect(JSON.stringify(en)).toContain("/og/default.png?lang=en");
    expect(JSON.stringify(pt)).toContain("/og/default.png");
    expect(JSON.stringify(pt)).not.toContain("lang=");
  });

  it("cai na língua-fonte quando o idioma pedido não existe no ficheiro", () => {
    // Defesa em profundidade: o `check-seo` já exige os dois blocos, mas um
    // locale novo acrescentado a `LOCALES` antes de alguém preencher os
    // `seo.ts` não deve deixar a página sem título nenhum.
    const soPt = { pt: rota.pt } as unknown as RouteSeo;
    expect(buildMetadata(soPt, termos, "en").title).toBe("Termos e Condições · UProperty Market");
  });

  it("deixa a sobreposição do Admin ganhar sem perder o idioma do resto", () => {
    const meta = buildMetadata(rota, termos, "en", { titleTag: "Edited in the Admin" });
    expect(meta.title).toBe("Edited in the Admin");
    // A descrição não foi sobreposta: continua a vir do bloco `en`, não do `pt`.
    expect(meta.description).toBe("The platform's Terms and Conditions.");
    expect(meta.openGraph?.locale).toBe("en_GB");
  });

  it("um campo vazio na sobreposição devolve o controlo ao ficheiro, no idioma certo", () => {
    const meta = buildMetadata(rota, termos, "en", { titleTag: "   " });
    expect(meta.title).toBe("Terms and Conditions · UProperty Market");
  });
});

/**
 * Os caminhos traduzidos (21 out 2026).
 *
 * É o mesmo tipo de falha silenciosa que os testes de cima guardam, só que um
 * degrau mais fundo: um canonical a apontar para `/en/termos` — um URL que não
 * existe — não parte página nenhuma, não dá erro de build e não aparece em
 * nenhum ecrã. Aparece meses depois, no Search Console, com a versão inglesa
 * fora do índice.
 */
describe("localizedPath — caminho traduzido", () => {
  it("traduz o caminho, e não só o prefixo", () => {
    // O coração da decisão do cliente: em inglês os caminhos traduzem-se.
    expect(localizedPath(termos, "en")).toBe("/en/terms");
    expect(localizedPath(termos, "pt")).toBe("/termos");
  });

  it("põe o canonical e o hreflang no caminho traduzido", () => {
    // Não basta o `localizedPath` estar certo: é por aqui que ele chega ao
    // `<head>`, e foi este caminho que a assinatura antiga tornava impossível.
    const meta = buildMetadata(rota, termos, "en");
    expect(meta.alternates?.canonical).toContain("/en/terms");
    expect(meta.alternates?.languages?.en).toContain("/en/terms");
    expect(meta.alternates?.languages?.pt).toMatch(/\/termos$/);
    // O `x-default` é a língua-fonte, e essa nunca leva prefixo nem tradução.
    expect(meta.alternates?.languages?.["x-default"]).toMatch(/\/termos$/);
  });

  it("preenche o segmento dinâmico no molde de cada idioma", () => {
    // A razão de ser de `{ pathname, params }`: de um caminho concreto em
    // português não se derivava o inglês.
    const imovel = {
      pathname: "/propriedades/[slug]",
      params: { slug: "casa-do-moinho" },
    } as const;
    expect(localizedPath(imovel, "pt")).toBe("/propriedades/casa-do-moinho");
    expect(localizedPath(imovel, "en")).toBe("/en/properties/casa-do-moinho");
  });

  it("a home não ganha barra a mais em nenhum dos idiomas", () => {
    expect(localizedPath({ pathname: "/" }, "pt")).toBe("/");
    expect(localizedPath({ pathname: "/" }, "en")).toBe("/en");
  });
});
