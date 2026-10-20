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

vi.mock("next/headers", () => ({
  headers: async () => ({ get: (key: string) => headerValues.get(key) ?? null }),
}));

vi.mock("@upm/db/server", () => ({
  createAnonClient: () => ({ rpc }),
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
});

describe("submitContact", () => {
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
  });
});
