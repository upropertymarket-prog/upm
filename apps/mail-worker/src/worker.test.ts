import { describe as group, expect, it } from "vitest";

import { readEnv } from "./env.ts";
import { normalizeSubject, syntheticId } from "./sync.ts";
import { renderNotificationEmail } from "./templates.ts";

/**
 * O que se testa aqui é o que decide correio duplicado, conversas partidas e
 * HTML injetado — as três coisas que, se falharem, falham em silêncio.
 */

const baseEnv = {
  SUPABASE_URL: "https://exemplo.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-de-teste-1234",
  MAIL_WORKER_TOKEN: "token-de-teste-com-32-caracteres",
};

group("readEnv", () => {
  it("recusa arrancar sem a chave de serviço", () => {
    const semChave = { ...baseEnv, SUPABASE_SERVICE_ROLE_KEY: undefined };
    expect(() => readEnv(semChave as NodeJS.ProcessEnv)).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("recusa um token curto — é a única porta dos endpoints", () => {
    expect(() => readEnv({ ...baseEnv, MAIL_WORKER_TOKEN: "curto" } as NodeJS.ProcessEnv)).toThrow(
      /MAIL_WORKER_TOKEN/,
    );
  });

  it("arranca sem RESEND_API_KEY, porque a entrada não depende da saída", () => {
    const env = readEnv(baseEnv as NodeJS.ProcessEnv);
    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.SYNC_INTERVAL_MINUTES).toBe(5);
  });
});

group("agrupamento de conversas", () => {
  it("tira os prefixos de resposta e reencaminhamento", () => {
    expect(normalizeSubject("Re: Fwd: Problema no mapa")).toBe("problema no mapa");
    expect(normalizeSubject("RE : RE: Visita")).toBe("visita");
    expect(normalizeSubject("Enc: Fatura")).toBe("fatura");
  });

  it("junta a resposta à mensagem original pelo assunto", () => {
    expect(normalizeSubject("Pedido de visita")).toBe(normalizeSubject("Re: Pedido de visita"));
  });
});

group("syntheticId", () => {
  const parsed = {
    date: new Date("2026-10-13T09:42:00.000Z"),
    from: { value: [{ address: "ana@example.pt", name: "Ana" }] },
    subject: "Re: O mapa fica em branco",
  } as never;

  it("é estável — é o que impede a passagem seguinte de duplicar a mensagem", () => {
    expect(syntheticId("caixa-1", parsed)).toBe(syntheticId("caixa-1", parsed));
  });

  it("distingue caixas, para a mesma mensagem em duas caixas não colidir", () => {
    expect(syntheticId("caixa-1", parsed)).not.toBe(syntheticId("caixa-2", parsed));
  });
});

group("renderNotificationEmail", () => {
  it("usa o título da fila como assunto", () => {
    const email = renderNotificationEmail(
      { title: "Nova mensagem de Ana", body: "Olá" },
      { appUrl: "https://app.exemplo.pt" },
    );
    expect(email.subject).toBe("Nova mensagem de Ana");
    expect(email.html).toContain("Nova mensagem de Ana");
  });

  it("escapa o conteúdo — o payload vem de nomes e títulos de terceiros", () => {
    const email = renderNotificationEmail(
      { title: "<script>alert(1)</script>", body: 'a & b "c"' },
      { appUrl: "https://app.exemplo.pt" },
    );
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("a &amp; b &quot;c&quot;");
  });

  it("transforma o link relativo da fila em absoluto", () => {
    const email = renderNotificationEmail(
      { title: "Pedido de visita", link: "/agenda/123" },
      { appUrl: "https://app.exemplo.pt/" },
    );
    expect(email.html).toContain("https://app.exemplo.pt/agenda/123");
    expect(email.text).toContain("https://app.exemplo.pt/agenda/123");
  });

  it("não inventa botão quando não há link", () => {
    const email = renderNotificationEmail({ title: "Aviso" }, { appUrl: "https://app.exemplo.pt" });
    expect(email.html).not.toContain("Abrir na app");
  });
});
