import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Testes das duas entradas públicas de leads (P2-02)
 * =========================================================================
 * `submit_site_lead` tem os seus próprios testes do lado do SQL, mas esses só
 * correm com credenciais. Estes correm sempre, e cobrem o que vive **nesta**
 * camada e em mais lado nenhum:
 *
 *  - o `zod`, que é o que dá mensagens por campo a quem escreveu mal;
 *  - o mapeamento para os parâmetros do RPC (um `p_` trocado é um defeito que
 *    nem o typecheck nem o build apanham);
 *  - o IP, que vem dos cabeçalhos e nunca do corpo — se algum dia passar a vir
 *    do cliente, o rate limit deixa de valer e é aqui que se vê;
 *  - a tradução do `hint` do Postgres em texto para o visitante.
 *
 * `next/headers` e o cliente Supabase são simulados: a action é código de
 * servidor e nenhum dos dois existe fora de um pedido real.
 */

const rpc = vi.fn();
const headerValues = new Map<string, string>();

/**
 * A fila de saída, simulada com a forma que o `supabase-js` tem de ter para o
 * encadeamento funcionar: cada método devolve o próprio objeto, e o `await` no
 * fim resolve. Guardamos o `insert` e os `eq` do cancelamento para os afirmar.
 */
const inserted: unknown[] = [];
const cancelled: Record<string, unknown>[] = [];
let insertError: { message: string } | null = null;

function deliveriesTable() {
  const filters: Record<string, unknown> = {};
  const chain: Record<string, unknown> = {
    insert: (row: unknown) => {
      inserted.push(row);
      return Promise.resolve({ error: insertError });
    },
    update: () => chain,
    eq: (column: string, value: unknown) => {
      filters[column] = value;
      // O cancelamento é o único `update` desta tabela aqui, e o terceiro `eq`
      // é o último — é nesse ponto que a consulta é enviada.
      if (Object.keys(filters).length === 3) cancelled.push({ ...filters });
      return chain;
    },
    then: (resolve: (value: { error: null }) => unknown) => resolve({ error: null }),
  };
  return chain;
}

const from = vi.fn(() => deliveriesTable());

vi.mock("next/headers", () => ({
  headers: async () => ({ get: (key: string) => headerValues.get(key) ?? null }),
}));

vi.mock("next-intl/server", () => ({
  getLocale: async () => "pt",
  // O e-mail leva texto traduzido; o teste só precisa de saber que a chave
  // certa foi pedida e que o `{name}` foi interpolado.
  getTranslations: async ({ namespace }: { namespace: string }) => {
    return (key: string, values?: Record<string, string>) =>
      values?.name ? `${namespace}.${key}:${values.name}` : `${namespace}.${key}`;
  },
}));

vi.mock("@upm/db/server", () => ({
  createAnonClient: () => ({ rpc }),
  createServiceClient: () => ({ from }),
}));

const { submitContact, submitPreRegistration } = await import("./actions");

/** O formato que `submit_site_lead` devolve: uma linha, numa lista. */
function row(over: Partial<Record<string, unknown>> = {}) {
  return {
    data: [{ lead_id: "11111111-1111-1111-1111-111111111111", confirm_token: "tok", ...over }],
    error: null,
  };
}

function formData(entries: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) form.set(key, value);
  return form;
}

const CONTACTO_VALIDO = {
  name: "Ana Dias",
  email: "ANA@Exemplo.PT",
  reason: "planos",
  message: "Qual é a diferença entre Smarter e Premium?",
  consentTerms: "on",
};

const PRE_INSCRICAO_VALIDA = {
  name: "Rui Nunes",
  email: "rui@exemplo.pt",
  profileType: "owner",
  consentTerms: "on",
};

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue(row());
  headerValues.clear();
  inserted.length = 0;
  cancelled.length = 0;
  insertError = null;
  from.mockClear();
});

describe("submitContact", () => {
  it("recusa sem a caixa dos Termos e da Privacidade, antes de chegar à base", async () => {
    const { consentTerms: _semCaixa, ...semConsentimento } = CONTACTO_VALIDO;
    void _semCaixa;
    const state = await submitContact({}, formData(semConsentimento));

    expect(state.fieldErrors?.consentTerms).toBe("Tem de aceitar os Termos para continuar.");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("recusa um e-mail inválido antes de chegar à base de dados", async () => {
    const state = await submitContact({}, formData({ ...CONTACTO_VALIDO, email: "ana@" }));

    expect(state.fieldErrors?.email).toBe("Verifique o endereço de e-mail.");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("recusa um nome com menos de dois caracteres", async () => {
    const state = await submitContact({}, formData({ ...CONTACTO_VALIDO, name: "A" }));

    expect(state.fieldErrors?.name).toBe("Escreva o seu nome.");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("normaliza o e-mail e envia o motivo e a mensagem", async () => {
    const state = await submitContact({}, formData(CONTACTO_VALIDO));

    expect(state).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith(
      "submit_site_lead",
      expect.objectContaining({
        p_form: "contacto",
        p_name: "Ana Dias",
        p_email: "ana@exemplo.pt",
        p_reason: "planos",
        p_message: CONTACTO_VALIDO.message,
        // Uma pergunta não é uma subscrição: o contacto nunca pede marketing.
        p_consent_marketing: false,
      }),
    );
  });

  it("recusa um motivo fora da lista do CRM", async () => {
    const state = await submitContact({}, formData({ ...CONTACTO_VALIDO, reason: "outra-coisa" }));

    expect(state.fieldErrors?.reason).toBeDefined();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("deixa o motivo por preencher quando não é escolhido", async () => {
    await submitContact({}, formData({ ...CONTACTO_VALIDO, reason: "" }));

    expect(rpc.mock.calls[0]?.[1]).toMatchObject({ p_reason: undefined });
  });

  it("encaminha o honeypot para a função, que decide em silêncio", async () => {
    rpc.mockResolvedValue({ data: [], error: null });

    const state = await submitContact(
      {},
      formData({ ...CONTACTO_VALIDO, website: "http://spam.example" }),
    );

    expect(rpc.mock.calls[0]?.[1]).toMatchObject({ p_honeypot: "http://spam.example" });
    // O bot vê o mesmo "obrigado" de toda a gente.
    expect(state).toEqual({ ok: true, alreadyConfirmed: false });
  });

  it("usa o primeiro endereço de x-forwarded-for", async () => {
    headerValues.set("x-forwarded-for", " 203.0.113.7 , 10.0.0.1 ");

    await submitContact({}, formData(CONTACTO_VALIDO));

    expect(rpc.mock.calls[0]?.[1]).toMatchObject({ p_ip: "203.0.113.7" });
  });

  it("cai em x-real-ip quando não há x-forwarded-for", async () => {
    headerValues.set("x-real-ip", "198.51.100.4");

    await submitContact({}, formData(CONTACTO_VALIDO));

    expect(rpc.mock.calls[0]?.[1]).toMatchObject({ p_ip: "198.51.100.4" });
  });

  it("explica o limite de ritmo, porque aí a pessoa pode fazer algo", async () => {
    rpc.mockResolvedValue({ data: null, error: { hint: "rate_limited" } });

    const state = await submitContact({}, formData(CONTACTO_VALIDO));

    expect(state.error).toBe(
      "Recebemos vários pedidos deste dispositivo. Tente daqui a alguns minutos.",
    );
  });

  it("não revela o motivo de qualquer outro erro", async () => {
    rpc.mockResolvedValue({ data: null, error: { hint: "invalid_profile_type" } });

    const state = await submitContact({}, formData(CONTACTO_VALIDO));

    expect(state.error).toBe("Não foi possível enviar o pedido. Tente novamente.");
  });
});

describe("submitPreRegistration", () => {
  it("exige os Termos, que nunca vêm pré-selecionados", async () => {
    const state = await submitPreRegistration(
      {},
      formData({ ...PRE_INSCRICAO_VALIDA, consentTerms: "" }),
    );

    expect(state.fieldErrors?.consentTerms).toBe("Tem de aceitar os Termos para continuar.");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("exige um perfil da lista", async () => {
    const state = await submitPreRegistration(
      {},
      formData({ ...PRE_INSCRICAO_VALIDA, profileType: "" }),
    );

    expect(state.fieldErrors?.profileType).toBe("Escolha o perfil que o descreve.");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("guarda a zona como mensagem e separa os dois consentimentos", async () => {
    await submitPreRegistration(
      {},
      formData({ ...PRE_INSCRICAO_VALIDA, zone: "Porto", consentMarketing: "on" }),
    );

    expect(rpc.mock.calls[0]?.[1]).toMatchObject({
      p_form: "preinscricao",
      p_profile_type: "owner",
      p_message: "Zona de interesse: Porto",
      p_consent_marketing: true,
    });
  });

  it("não inventa mensagem quando a zona fica vazia", async () => {
    await submitPreRegistration({}, formData({ ...PRE_INSCRICAO_VALIDA, zone: "" }));

    expect(rpc.mock.calls[0]?.[1]).toMatchObject({
      p_message: undefined,
      // Aceitar os Termos não é aceitar marketing.
      p_consent_marketing: false,
    });
  });

  it("diz que já estava confirmado, para não prometer um e-mail que não sai", async () => {
    rpc.mockResolvedValue(row({ confirm_token: null, already_confirmed: true }));

    const state = await submitPreRegistration({}, formData(PRE_INSCRICAO_VALIDA));

    expect(state).toEqual({ ok: true, alreadyConfirmed: true });
    // E, por não haver token, não se enfileira nada.
    expect(inserted).toHaveLength(0);
  });
});

/**
 * A confirmação do double opt-in — o que estava em falta e fazia com que
 * nenhuma pré-inscrição contasse como lead.
 *
 * O envio em si é do `mail-worker`; o que se testa aqui é a única coisa que
 * vive nesta camada: que a entrega vai para a fila, com o link certo, sem
 * perfil, e que a entrega anterior é cancelada.
 */
describe("confirmação da pré-inscrição", () => {
  it("enfileira o e-mail com o token no link", async () => {
    await submitPreRegistration({}, formData(PRE_INSCRICAO_VALIDA));

    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      channel: "email",
      recipient: "rui@exemplo.pt",
      template: "site_lead_confirmation",
    });

    const payload = (inserted[0] as { payload: Record<string, string> }).payload;
    expect(payload.link).toContain("/pre-inscricao/confirmar?token=tok");
    // Absoluto: um link de e-mail não tem página de onde ser relativo.
    expect(payload.link).toMatch(/^https?:\/\//);
    expect(payload.lang).toBe("pt");
    // O nome entra no corpo pelo ICU, não por concatenação.
    expect(payload.body).toContain("Rui Nunes");
  });

  it("não leva `profile_id`: quem se pré-inscreve não tem conta", async () => {
    await submitPreRegistration({}, formData(PRE_INSCRICAO_VALIDA));

    expect(inserted[0]).not.toHaveProperty("profile_id");
  });

  it("cancela a entrega anterior, porque o token dela já não serve", async () => {
    await submitPreRegistration({}, formData(PRE_INSCRICAO_VALIDA));

    expect(cancelled).toEqual([
      {
        recipient: "rui@exemplo.pt",
        template: "site_lead_confirmation",
        status: "queued",
      },
    ]);
  });

  it("falha o pedido quando a fila recusa, em vez de prometer um e-mail", async () => {
    insertError = { message: "fila indisponível" };

    const state = await submitPreRegistration({}, formData(PRE_INSCRICAO_VALIDA));

    expect(state.ok).toBeUndefined();
    expect(state.error).toBe("Não foi possível enviar o pedido. Tente novamente.");
  });

  it("não confirma por e-mail quem usou o formulário de contacto", async () => {
    await submitContact({}, formData(CONTACTO_VALIDO));

    // Quem faz uma pergunta não espera um passo a mais para a fazer chegar.
    expect(inserted).toHaveLength(0);
  });

  it("não enfileira nada quando o honeypot apanha um bot", async () => {
    // A função SQL devolve uma linha de nulos e grava nada — o mesmo "obrigado"
    // para o bot, e zero e-mails enviados a um endereço que ele escolheu.
    rpc.mockResolvedValue(row({ lead_id: null, confirm_token: null }));

    const state = await submitPreRegistration(
      {},
      formData({ ...PRE_INSCRICAO_VALIDA, website: "http://spam.example" }),
    );

    expect(state).toEqual({ ok: true });
    expect(inserted).toHaveLength(0);
  });
});
