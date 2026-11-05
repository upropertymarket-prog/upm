import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * O consentimento de marketing no registo (D69)
 * =========================================================================
 * `registerAccount` não tinha testes, e este ficheiro não tenta dar-lhos todos:
 * cobre **a caixa de marketing**, que é o que acabou de entrar, e cobre-a por
 * uma razão concreta.
 *
 * D69 existiu porque `profiles.marketing_consent` nascia sempre `false` e
 * ninguém dava por isso: o registo corria bem, a conta era criada, o pagamento
 * passava, e só do outro lado — nas audiências de campanha, todas a zero — é
 * que o efeito aparecia, muito depois e longe daqui. Um `name` trocado neste
 * formulário reproduz a mesma falha **exatamente da mesma maneira**: sem erro,
 * sem aviso, sem teste vermelho. É isso que estes casos impedem.
 *
 * Tudo o que fala com o mundo é simulado — `signUp`, o Stripe, os três RPC.
 * O que não se simula são os `zod` de `@upm/db/auth`: se o NIF ou a password
 * passassem a ser validados de outra forma, um teste com schemas falsos
 * continuaria verde a testar um registo que já não existe.
 */

const rpc = vi.fn();
const signUp = vi.fn();
const maybeSingle = vi.fn();
const profileUpdates: Record<string, unknown>[] = [];
const customersCreate = vi.fn();
const sessionsCreate = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
  headers: async () => ({ get: () => null }),
}));

/** O erro que a próxima escrita em `profiles` devolve; `null` = corre bem. */
let profileWriteError: { message: string } | null = null;

/**
 * Encadeamento do `supabase-js`: cada método devolve o próprio objeto, e o
 * objeto é aguardável — é no `await` final que a resposta aparece, esteja ele
 * depois de um `.eq()` ou de um `.is()`.
 */
function tableMock(table: string) {
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    is: () => chain,
    maybeSingle: () => maybeSingle(table),
    update: (values: Record<string, unknown>) => {
      if (table === "profiles") profileUpdates.push(values);
      return chain;
    },
    then: (resolve: (value: { error: { message: string } | null }) => unknown) =>
      resolve({ error: table === "profiles" ? profileWriteError : null }),
  };
  return chain;
}

vi.mock("@upm/db/server", () => ({
  createClient: () => ({ auth: { signUp }, from: tableMock }),
  createServiceClient: () => ({ rpc, from: tableMock }),
}));

vi.mock("@upm/db/stripe", () => ({
  getStripeClient: () => ({
    customers: { create: customersCreate },
    checkout: { sessions: { create: sessionsCreate } },
  }),
}));

// Os schemas são os verdadeiros (ver a nota de topo); só o que sai para a rede
// é que se trava.
vi.mock("@upm/db/auth", async (importOriginal) => {
  const real = await importOriginal<typeof import("@upm/db/auth")>();
  return {
    ...real,
    checkAuthRateLimit: async () => ({ allowed: true, retryAfterSeconds: 0 }),
    recordAuthAttempt: async () => undefined,
    isPasswordPwned: async () => false,
  };
});

// O registo só existe depois do lançamento (12 §34.5): estes casos correm em
// `post`. O último bloco prova o contrário.
vi.stubEnv("UPM_LAUNCH_MODE_OVERRIDE", "post");

const { registerAccount } = await import("./actions");

const PROFILE_ID = "11111111-1111-1111-1111-111111111111";
const TERMS_ID = "22222222-2222-2222-2222-222222222222";

/** Um registo que passa de ponta a ponta. A caixa de marketing é à parte. */
const REGISTO_VALIDO: Record<string, string> = {
  role: "owner",
  fullName: "Rui Nunes",
  email: "rui@exemplo.pt",
  password: "uma-palavra-passe-longa",
  taxId: "243817533",
  phone: "+351912345678",
  planSlug: "premium",
  interval: "month",
  acceptTerms: "on",
  termsDocumentId: TERMS_ID,
  termsContentHash: "hash-dos-termos",
};

function formData(entries: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) form.set(key, value);
  return form;
}

beforeEach(() => {
  profileUpdates.length = 0;
  profileWriteError = null;

  signUp.mockReset().mockResolvedValue({ data: { user: { id: PROFILE_ID } }, error: null });

  rpc.mockReset().mockImplementation(async (name: string) => {
    if (name === "signup_eligibility") return { data: { allowed: true }, error: null };
    return { data: null, error: null };
  });

  maybeSingle.mockReset().mockImplementation(async (table: string) => {
    if (table === "plans") {
      return {
        data: {
          id: "plano-1",
          slug: "premium",
          name: "Premium",
          audience: "owner",
          price_month_cents: 2999,
          price_year_cents: 29990,
          stripe_price_month_id: "price_123",
        },
        error: null,
      };
    }
    if (table === "legal_documents") {
      return {
        data: { id: TERMS_ID, version: "1.0", content_hash: "hash-dos-termos" },
        error: null,
      };
    }
    return { data: null, error: null };
  });

  customersCreate.mockReset().mockResolvedValue({ id: "cus_123" });
  sessionsCreate.mockReset().mockResolvedValue({ url: "https://checkout.stripe.test/sessao" });
});

/** As escritas em `profiles` que mexem no consentimento, e só essas. */
function consentWrites() {
  return profileUpdates.filter((values) => "marketing_consent" in values);
}

describe("consentimento de marketing (D69)", () => {
  it("é um registo que chega ao Checkout — a base dos casos seguintes", async () => {
    const state = await registerAccount({}, formData(REGISTO_VALIDO));

    expect(state.error).toBeUndefined();
    expect(state.checkoutUrl).toBe("https://checkout.stripe.test/sessao");
  });

  it("grava o consentimento quando a caixa vem marcada", async () => {
    await registerAccount({}, formData({ ...REGISTO_VALIDO, marketingConsent: "on" }));

    expect(consentWrites()).toHaveLength(1);
    expect(consentWrites()[0]).toMatchObject({ marketing_consent: true });
  });

  it("grava a data ao lado do booleano, que é o que a constraint exige", async () => {
    // `profiles_marketing_consent_timestamp` exige
    // `marketing_consent = (marketing_consent_at is not null)`: um booleano sem
    // data é uma escrita que o Postgres recusa — e é a data que faz do
    // consentimento prova.
    await registerAccount({}, formData({ ...REGISTO_VALIDO, marketingConsent: "on" }));

    const at = consentWrites()[0]?.marketing_consent_at;
    expect(typeof at).toBe("string");
    expect(Number.isNaN(Date.parse(at as string))).toBe(false);
  });

  it("não escreve nada quando a caixa fica por marcar", async () => {
    // A linha já nasce `false` com data nula: repetir isso era uma escrita a
    // mais. "Não consentiu" e "consentiu que não" são a mesma coisa aqui.
    await registerAccount({}, formData(REGISTO_VALIDO));

    expect(consentWrites()).toHaveLength(0);
  });

  it("não deixa o consentimento depender de aceitar os Termos", async () => {
    // Os dois são separados: os Termos são obrigatórios e autorizam o
    // tratamento; o marketing é opcional e tem de o ser, senão não é
    // consentimento. Sem os Termos não há registo nenhum — nem consentimento.
    const state = await registerAccount(
      {},
      formData({ ...REGISTO_VALIDO, acceptTerms: "", marketingConsent: "on" }),
    );

    expect(state.step).toBe("contract");
    expect(consentWrites()).toHaveLength(0);
    expect(signUp).not.toHaveBeenCalled();
  });

  it("não perde a conta quando a gravação do consentimento falha", async () => {
    // A conta está criada e vai ser paga. Perdê-la por causa de uma caixa
    // opcional seria pior do que a pessoa não receber campanhas.
    const erro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    profileWriteError = { message: "sem permissão" };

    const state = await registerAccount(
      {},
      formData({ ...REGISTO_VALIDO, marketingConsent: "on" }),
    );

    expect(state.checkoutUrl).toBe("https://checkout.stripe.test/sessao");
    expect(erro).toHaveBeenCalledWith(expect.stringContaining("sem permissão"));
    erro.mockRestore();
  });
});

describe("em pré-lançamento o registo não existe (12 §34.5)", () => {
  it("devolve à página de pré-lançamento sem criar conta nem abrir pagamento", async () => {
    vi.stubEnv("UPM_LAUNCH_MODE_OVERRIDE", "pre");
    try {
      // Chamada direta, sem passar pela página: é assim que uma Server Action
      // se invoca pelo identificador, e o middleware não a vê.
      await expect(registerAccount({}, formData(REGISTO_VALIDO))).rejects.toThrow("NEXT_REDIRECT");
      expect(signUp).not.toHaveBeenCalled();
      expect(sessionsCreate).not.toHaveBeenCalled();
    } finally {
      vi.stubEnv("UPM_LAUNCH_MODE_OVERRIDE", "post");
    }
  });
});
