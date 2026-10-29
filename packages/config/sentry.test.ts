import { describe, expect, it } from "vitest";

import { REDACTED, scrubSentryEvent, scrubString } from "./sentry";

/**
 * A rede que impede dados pessoais de saírem para o Sentry (12 §9.3).
 *
 * Metade destes testes verifica que a limpeza apaga o que deve. A outra metade
 * verifica que **não** apaga o que faz falta — e essa é a que mantém a função
 * viva: uma limpeza que estraga a mensagem de erro é desligada na primeira
 * madrugada em que alguém precisar dela.
 */
describe("scrubString", () => {
  it("apaga e-mails", () => {
    expect(scrubString("falhou para jose.curado@exemplo.pt às 3h")).toBe(
      `falhou para ${REDACTED} às 3h`,
    );
  });

  it("apaga JWTs e cabeçalhos de autorização", () => {
    expect(scrubString("token=eyJhbGciOi.eyJzdWIi.abc-123")).toBe(`token=${REDACTED}`);
    expect(scrubString("Authorization: Bearer abc.def-123")).toBe(
      `Authorization: Bearer ${REDACTED}`,
    );
  });

  it("NÃO apaga números que parecem telefone ou NIF em texto livre", () => {
    // Nove dígitos é a forma de um telefone, de um NIF, de um timestamp, de um
    // código de erro e de um número de versão. Limpar por padrão aqui
    // estragaria a mensagem; estes limpam-se pela chave (ver abaixo).
    const mensagem = "falhou ao escrever a linha 912345678 do lote 202610280";
    expect(scrubString(mensagem)).toBe(mensagem);
  });

  it("NÃO toca em caminhos, nomes de função nem IDs", () => {
    const mensagem = "TypeError em setTicketStatus (app/suporte/tickets/actions.ts:42)";
    expect(scrubString(mensagem)).toBe(mensagem);
  });
});

describe("scrubSentryEvent — o que não sai", () => {
  it("do utilizador fica só o id", () => {
    const evento = scrubSentryEvent({
      user: { id: "9f1c", email: "a@b.pt", ip_address: "192.0.2.7", username: "jose" },
    });
    expect(evento.user).toEqual({ id: "9f1c" });
  });

  it("apaga cookies, cabeçalhos, corpo e query do pedido", () => {
    const evento = scrubSentryEvent({
      request: {
        url: "https://app.upm.pt/propriedades?token=abc&email=a@b.pt",
        method: "POST",
        cookies: { "sb-access-token": "abc" },
        headers: { authorization: "Bearer abc" },
        data: { password: "hunter2" },
        query_string: "token=abc",
      },
    });

    expect(evento.request).toEqual({
      url: "https://app.upm.pt/propriedades",
      method: "POST",
    });
  });

  it("limpa pelo NOME da chave, em qualquer grafia", () => {
    const evento = scrubSentryEvent({
      extra: {
        lead: {
          nome: "José Curado",
          email: "jose@exemplo.pt",
          telefone: "912345678",
          NIF: "123456789",
          palavraPasse: "hunter2",
          "codigo-postal": "1000-001",
        },
      },
    });

    expect(evento.extra).toEqual({
      lead: {
        // O nome fica: não está na lista, e sem ele metade dos erros de
        // formulário deixam de se perceber.
        nome: "José Curado",
        email: REDACTED,
        telefone: REDACTED,
        NIF: REDACTED,
        palavraPasse: REDACTED,
        "codigo-postal": REDACTED,
      },
    });
  });

  it("limpa dentro de arrays e em profundidade", () => {
    const evento = scrubSentryEvent({
      extra: { destinatarios: [{ email: "a@b.pt" }, { email: "c@d.pt" }] },
    });
    expect(evento.extra).toEqual({
      destinatarios: [{ email: REDACTED }, { email: REDACTED }],
    });
  });

  it("limpa a mensagem, as exceções e os breadcrumbs", () => {
    const evento = scrubSentryEvent({
      message: "sem conta para a@b.pt",
      exception: { values: [{ value: "duplicado: a@b.pt" }] },
      breadcrumbs: [{ message: "submeteu a@b.pt", data: { email: "a@b.pt" } }],
    });

    expect(evento.message).toBe(`sem conta para ${REDACTED}`);
    expect(evento.exception?.values?.[0]?.value).toBe(`duplicado: ${REDACTED}`);
    expect(evento.breadcrumbs?.[0]?.["message"]).toBe(`submeteu ${REDACTED}`);
    expect(evento.breadcrumbs?.[0]?.["data"]).toEqual({ email: REDACTED });
  });
});

describe("scrubSentryEvent — robustez", () => {
  it("nunca devolve null: perder o erro é perder a razão de ter Sentry", () => {
    expect(scrubSentryEvent({})).toEqual({});
  });

  it("um objeto que se refere a si mesmo não põe a limpeza em ciclo", () => {
    const ciclico: Record<string, unknown> = { nome: "a" };
    ciclico["eu"] = ciclico;
    const evento = scrubSentryEvent({ extra: { ciclico } });
    expect(evento.extra).toBeDefined();
  });

  it("sobrevive a um evento sem nada dentro", () => {
    const evento = scrubSentryEvent({
      user: null,
      request: null,
      extra: null,
      exception: null,
      breadcrumbs: null,
    });
    expect(evento.user).toBeNull();
  });

  it("deixa passar a pilha de chamadas, que é a razão do relatório", () => {
    const evento = scrubSentryEvent({
      exception: {
        values: [{ value: "Cannot read properties of undefined (reading 'role')" }],
      },
    });
    expect(evento.exception?.values?.[0]?.value).toContain("reading 'role'");
  });
});
