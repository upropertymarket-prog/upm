import { describe, expect, it } from "vitest";

import type { CampaignBlock } from "./campaign-blocks";
import {
  renderCampaignHtml,
  renderCampaignText,
  type CampaignRenderContext,
} from "./campaign-render";

/**
 * O que se testa aqui é o que sai para milhares de caixas de entrada de uma
 * vez. Três coisas, por ordem de gravidade: que o link de cancelar subscrição
 * **está sempre lá** (02 §4.3, e é obrigação legal), que as variáveis saem
 * substituídas e escapadas, e que um bloco sem dados desaparece em vez de
 * desenhar uma moldura vazia.
 */

const context: CampaignRenderContext = {
  assetBaseUrl: "https://cdn.upropertymarket.pt/campanhas",
  unsubscribeUrl: "https://upropertymarket.pt/cancelar?t=abc123",
  labels: { unsubscribe: "Cancelar subscrição" },
};

const footer: CampaignBlock = {
  id: "f",
  type: "footer",
  align: "center",
  text: "Recebeu isto porque subscreveu as novidades.",
};

describe("renderCampaignHtml", () => {
  it("põe sempre o link de cancelar subscrição, com o token do destinatário", async () => {
    const html = await renderCampaignHtml([footer], context);
    expect(html).toContain("https://upropertymarket.pt/cancelar?t=abc123");
    expect(html).toContain("Cancelar subscrição");
  });

  it("substitui as variáveis quando há valores", async () => {
    const blocks: CampaignBlock[] = [
      { id: "h", type: "heading", align: "left", level: 1, text: "Olá" },
      {
        id: "t",
        type: "text",
        align: "left",
        html: '<p>Olá <span data-variable="nome">Nome</span>, o plano é <span data-variable="plano">Plano</span>.</p>',
      },
      footer,
    ];

    const html = await renderCampaignHtml(blocks, {
      ...context,
      values: { nome: "Ana", plano: "Premium" },
    });
    expect(html).toContain("Olá Ana, o plano é Premium.");
    expect(html).not.toContain("data-variable");
  });

  it("sem valores, deixa os rótulos — é a pré-visualização sem dados", async () => {
    const blocks: CampaignBlock[] = [
      { id: "t", type: "text", align: "left", html: '<span data-variable="nome">Nome</span>' },
      footer,
    ];
    const html = await renderCampaignHtml(blocks, context);
    expect(html).toContain("Nome");
  });

  it("escapa o valor substituído — o nome é texto do próprio utilizador", async () => {
    const blocks: CampaignBlock[] = [
      { id: "t", type: "text", align: "left", html: '<span data-variable="nome">Nome</span>' },
      footer,
    ];
    const html = await renderCampaignHtml(blocks, {
      ...context,
      values: { nome: "<script>alert(1)</script>" },
    });
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("o bloco do imóvel desaparece quando não há imóvel resolvido", async () => {
    const blocks: CampaignBlock[] = [
      { id: "p", type: "property", align: "left", propertyId: null },
      footer,
    ];
    const html = await renderCampaignHtml(blocks, context);
    // Nem moldura, nem preço, nem um cartão vazio: um cartão sem dados num
    // e-mail de marketing lê-se como erro do remetente.
    expect(html).not.toContain("border-radius:10px");
  });

  it("desenha o imóvel quando ele vem no contexto", async () => {
    const blocks: CampaignBlock[] = [
      {
        id: "p",
        type: "property",
        align: "left",
        propertyId: "11111111-1111-1111-1111-111111111111",
      },
      footer,
    ];
    const html = await renderCampaignHtml(blocks, {
      ...context,
      property: {
        title: "T2 em Alvalade",
        price: "320 000 €",
        location: "Lisboa",
        imageUrl: "https://cdn.upropertymarket.pt/imoveis/1.jpg",
        url: "https://upropertymarket.pt/imoveis/t2-alvalade",
      },
    });
    expect(html).toContain("T2 em Alvalade");
    expect(html).toContain("320 000 €");
  });

  it("a assinatura só aparece se a caixa a trouxer (07 §24.6 #3)", async () => {
    const blocks: CampaignBlock[] = [
      { id: "s", type: "signature", align: "left", mailboxId: null },
      footer,
    ];
    expect(await renderCampaignHtml(blocks, context)).not.toContain("Ana Suporte");
    expect(
      await renderCampaignHtml(blocks, { ...context, signatureHtml: "<p>Ana Suporte</p>" }),
    ).toContain("Ana Suporte");
  });

  it("sem logótipo em PNG, o cabeçalho leva a marca em texto (D67)", async () => {
    const blocks: CampaignBlock[] = [
      { id: "h", type: "header", align: "left", logoPath: "", logoAlt: "UProperty Market" },
      footer,
    ];
    const html = await renderCampaignHtml(blocks, context);
    expect(html).toContain("UProperty Market");
    expect(html).not.toContain("<img");
  });

  it("o pré-cabeçalho entra quando existe", async () => {
    const html = await renderCampaignHtml([footer], {
      ...context,
      preheader: "As novidades de hoje",
    });
    expect(html).toContain("As novidades de hoje");
  });

  it("sai como tabelas e estilos em linha, que é o que os clientes desenham", async () => {
    const html = await renderCampaignHtml([footer], context);
    expect(html).toContain("<table");
    // Nenhum `<style>` de cabeçalho com regras nossas: o Gmail remove-o.
    expect(html).not.toContain("display:flex");
  });
});

describe("renderCampaignText", () => {
  it("leva o link de cancelar subscrição também em texto", () => {
    const text = renderCampaignText([footer], context);
    expect(text).toContain("Cancelar subscrição: https://upropertymarket.pt/cancelar?t=abc123");
  });

  it("um botão em texto diz para onde vai", () => {
    const blocks: CampaignBlock[] = [
      { id: "b", type: "button", align: "center", label: "Ver imóveis", href: "https://x.pt/i" },
      footer,
    ];
    expect(renderCampaignText(blocks, context)).toContain("Ver imóveis (https://x.pt/i)");
  });

  it("a imagem vira o seu `alt`, que é o que resta dela em texto", () => {
    const blocks: CampaignBlock[] = [
      { id: "i", type: "image", align: "left", path: "a.png", alt: "Fachada", href: "" },
      footer,
    ];
    expect(renderCampaignText(blocks, context)).toContain("[Fachada]");
  });

  it("substitui as variáveis também em texto", () => {
    const blocks: CampaignBlock[] = [
      {
        id: "t",
        type: "text",
        align: "left",
        html: '<p>Olá <span data-variable="nome">Nome</span></p>',
      },
      footer,
    ];
    expect(renderCampaignText(blocks, { ...context, values: { nome: "Ana" } })).toContain(
      "Olá Ana",
    );
  });

  it("não deixa paredes de linhas em branco", () => {
    const blocks: CampaignBlock[] = [
      { id: "s1", type: "spacer", height: 24 },
      { id: "s2", type: "spacer", height: 24 },
      { id: "h", type: "heading", align: "left", level: 1, text: "Olá" },
      footer,
    ];
    expect(renderCampaignText(blocks, context)).not.toMatch(/\n{3}/);
  });
});
