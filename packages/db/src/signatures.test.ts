import { describe, expect, it } from "vitest";

import {
  SIGNATURE_TEMPLATE,
  SIGNATURE_VARIABLES,
  inspectSignature,
  sanitizeSignature,
  signatureSaveSchema,
} from "./signatures";

/**
 * O que se testa aqui é o que decide se um `<script>` colado numa assinatura
 * corre no browser de quem está no Suporte (o composer insere a assinatura por
 * `innerHTML`) e se o aviso do ecrã diz a verdade sobre o que vai ser retirado.
 * As duas coisas falham em silêncio: a primeira até alguém a explorar, a
 * segunda até alguém reparar que a assinatura não ficou como a viu.
 */

describe("sanitizeSignature", () => {
  it("tira o script e não deixa o código a aparecer como texto", () => {
    const clean = sanitizeSignature("<p>Ana</p><script>alert(1)</script>");
    expect(clean).not.toContain("script");
    // `nonTextTags`: sem ele, `sanitize-html` deixava `alert(1)` escrito na
    // assinatura — o código desaparecia da marcação e aparecia na mensagem.
    expect(clean).not.toContain("alert(1)");
    expect(clean).toContain("Ana");
  });

  it("tira os atributos de evento e mantém o resto da etiqueta", () => {
    const clean = sanitizeSignature('<img src="https://x.pt/a.png" alt="a" onerror="alert(1)" />');
    expect(clean).not.toContain("onerror");
    expect(clean).toContain('src="https://x.pt/a.png"');
  });

  it("recusa um href `javascript:` e deixa `mailto:` e `tel:` passar", () => {
    expect(sanitizeSignature('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript");
    expect(sanitizeSignature('<a href="mailto:a@b.pt">a</a>')).toContain("mailto:a@b.pt");
    expect(sanitizeSignature('<a href="tel:+351210000000">t</a>')).toContain("tel:");
  });

  it("acrescenta `rel` aos links — a assinatura abre no exterior", () => {
    expect(sanitizeSignature('<a href="https://upropertymarket.pt">s</a>')).toContain(
      'rel="noopener noreferrer"',
    );
  });

  it("mantém o que desenha uma assinatura: tabelas e style em linha", () => {
    const clean = sanitizeSignature(SIGNATURE_TEMPLATE);
    expect(clean).toContain("<table");
    // Sem espaço depois dos dois pontos: o sanitizador reescreve o `style`
    // depois de o interpretar, e é por isso que o que se guarda não é, byte por
    // byte, o que se escreveu — só o que ele reconheceu como CSS válido.
    expect(clean).toContain("border-left:2px solid #CBD5E1");
    // As variáveis são texto e têm de sobreviver intactas à sanitização, senão
    // o composer inseria `{{nome}}` por resolver.
    for (const name of ["nome", "cargo", "departamento", "email", "telefone"]) {
      expect(clean).toContain(`{{${name}}}`);
    }
  });

  it("tira `<style>` — uma folha dentro do e-mail vaza para a mensagem de quem responde", () => {
    const clean = sanitizeSignature("<style>p{color:red}</style><p>Ana</p>");
    expect(clean).not.toContain("style>");
    expect(clean).not.toContain("color:red");
  });

  it("tira `class`, que numa assinatura não tem folha que a sirva", () => {
    expect(sanitizeSignature('<p class="titulo">Ana</p>')).not.toContain("class");
  });

  it("tira o iframe e o formulário", () => {
    const clean = sanitizeSignature(
      '<iframe src="https://x.pt"></iframe><form action="https://x.pt"><input /></form>',
    );
    expect(clean).not.toContain("iframe");
    expect(clean).not.toContain("form");
  });
});

describe("inspectSignature", () => {
  it("diz o que vai sair, por etiqueta e por atributo", () => {
    const { findings } = inspectSignature('<script>a</script><img onerror="x" src="y" />');
    const unsafe = findings.filter((finding) => finding.kind === "unsafe").map((f) => f.detail);
    expect(unsafe).toContain("<script>");
    expect(unsafe).toContain("onerror=");
  });

  it("não avisa quando o sanitizador só arruma a marcação", () => {
    // `<p>Ana` fecha-se sozinho na saída; isso **não** é um aviso. Um aviso a
    // cada etiqueta bem fechada é um aviso que ninguém volta a ler.
    const { findings } = inspectSignature("<p>Ana<br></p>");
    expect(findings).toHaveLength(0);
  });

  it("distingue variáveis conhecidas de inventadas", () => {
    const { findings, variables } = inspectSignature(
      "<p>{{nome}} · {{cargo}} · {{morada}} · {{ telefone }}</p>",
    );
    expect(variables).toEqual(expect.arrayContaining(["nome", "cargo", "telefone"]));
    const unknown = findings
      .filter((finding) => finding.kind === "unknownVariable")
      .map((f) => f.detail);
    expect(unknown).toEqual(["{{morada}}"]);
  });

  it("devolve o HTML limpo, que é o que a action grava", () => {
    const { clean } = inspectSignature("<p>Ana</p><script>alert(1)</script>");
    expect(clean).toBe(sanitizeSignature("<p>Ana</p><script>alert(1)</script>"));
  });

  it("apanha `javascript:` mesmo escrito com espaço, como o faz quem o esconde", () => {
    const { findings } = inspectSignature('<a href="javascript :alert(1)">x</a>');
    expect(findings.some((finding) => finding.detail === "javascript:")).toBe(true);
  });

  it("o desenho de 04 §2.6 não dá avisos — é o ponto de partida do editor", () => {
    expect(inspectSignature(SIGNATURE_TEMPLATE).findings).toHaveLength(0);
  });

  it("o desenho não aponta para nenhuma imagem (D67)", () => {
    // Os logótipos do projeto são SVG, que os clientes de correio não desenham,
    // e não existe PNG nenhum. Um `src` para um caminho inventado dava um
    // retângulo partido na assinatura de toda a equipa — é a lição de D63.
    expect(SIGNATURE_TEMPLATE).not.toContain("<img");
    expect(SIGNATURE_TEMPLATE).toContain("UProperty Market");
  });
});

describe("signatureSaveSchema", () => {
  // Uma assinatura para toda a empresa (29 out 2026): só o HTML entra. Nome e
  // caixas deixaram de existir no ecrã e na função.
  it("aceita só o HTML", () => {
    const result = signatureSaveSchema.safeParse({ html: "<p>a</p>" });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ html: "<p>a</p>" });
  });

  it("aceita o HTML vazio — é assim que se tira a assinatura dos e-mails", () => {
    expect(signatureSaveSchema.safeParse({ html: "" }).success).toBe(true);
  });

  it("recusa uma página inteira colada por engano", () => {
    expect(signatureSaveSchema.safeParse({ html: "x".repeat(200_001) }).success).toBe(false);
  });

  it("as seis variáveis de 05 §1.8, e só estas", () => {
    expect(SIGNATURE_VARIABLES).toEqual([
      "nome",
      "cargo",
      "departamento",
      "email",
      "telefone",
      "iniciais",
    ]);
  });
});
