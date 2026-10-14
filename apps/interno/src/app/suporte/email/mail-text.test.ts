import { describe, expect, it } from "vitest";

import { htmlToText, parseAddresses } from "./mail-text";

/**
 * `htmlToText` nasceu com a migração do Composer para o editor partilhado
 * (14 out 2026): era o `innerText` do `contentEditable`, que desapareceu com
 * ele. Serve a parte `text/plain` da mensagem — a que um cliente de correio
 * sem HTML mostra —, e um erro aqui não dá erro nenhum: dá um e-mail que
 * chega com o corpo colado numa palavra só a quem o lê em texto simples.
 */

describe("htmlToText", () => {
  it("fecha os blocos em linhas em vez de colar as palavras", () => {
    expect(htmlToText("<p>Boa tarde</p><p>Obrigado</p>")).toBe("Boa tarde\nObrigado");
  });

  it("trata o `<br>` como linha, com ou sem barra", () => {
    expect(htmlToText("<p>Linha um<br>Linha dois<br />Linha três</p>")).toBe(
      "Linha um\nLinha dois\nLinha três",
    );
  });

  it("lê uma lista como linhas", () => {
    expect(htmlToText("<ul><li>Um</li><li>Dois</li></ul>")).toBe("Um\nDois");
  });

  it("tira as etiquetas sem tirar o texto que está dentro delas", () => {
    expect(htmlToText("<p>Com <strong>negrito</strong> e <em>itálico</em></p>")).toBe(
      "Com negrito e itálico",
    );
  });

  it("devolve as entidades ao que eram", () => {
    expect(htmlToText("<p>Ana &amp; Rui &lt;3 &quot;isto&quot;&nbsp;aqui</p>")).toBe(
      'Ana & Rui <3 "isto" aqui',
    );
  });

  it("desfaz o `&amp;` em último — a ordem importa", () => {
    // Trocar o `&amp;` primeiro transformava `&amp;lt;` em `<`, que é o texto
    // errado: quem escreveu queria mostrar a sequência, não o sinal.
    expect(htmlToText("<p>&amp;lt;</p>")).toBe("&lt;");
  });

  it("não deixa paredes de linhas em branco", () => {
    expect(htmlToText("<p>Um</p><p></p><p></p><p></p><p>Dois</p>")).toBe("Um\n\nDois");
  });

  it("sobrevive a um corpo vazio, que é como o editor abre", () => {
    expect(htmlToText("<p></p>")).toBe("");
    expect(htmlToText("")).toBe("");
  });

  it("mantém a assinatura separada pelo traço", () => {
    // O Composer insere a assinatura depois de um `<hr>`; em texto simples o
    // traço desaparece, mas a separação em linhas tem de ficar.
    const body = "<p>Obrigado</p><hr /><p>Ana Silva</p><p>Suporte</p>";
    expect(htmlToText(body)).toBe("Obrigado\nAna Silva\nSuporte");
  });
});

describe("parseAddresses", () => {
  it("aceita vírgula e ponto e vírgula, como os clientes de correio", () => {
    expect(parseAddresses("ana@x.pt, rui@y.pt; zé@z.pt")).toEqual([
      "ana@x.pt",
      "rui@y.pt",
      "zé@z.pt",
    ]);
  });

  it("ignora o que fica vazio entre separadores", () => {
    expect(parseAddresses("ana@x.pt,,  ;")).toEqual(["ana@x.pt"]);
  });
});
