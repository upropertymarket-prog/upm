import { pendingRpc } from "./pending-types";

/**
 * Contrato de adesão (doc 13, D58)
 * =========================================================================
 * O documento que fixa o negócio concreto de um subscritor. Lê-se de
 * `subscription_agreements`, **nunca de `plans`**: o contrato tem de dizer o
 * preço do dia em que foi celebrado, e `plans` é editável no Admin.
 *
 * Por isso este ficheiro não tem um único cálculo de preço. Se algum dia
 * aparecer aqui um `price_month_cents`, é sinal de que alguém voltou a derivar
 * o contrato em vez de o ler.
 */

/** A forma em que a tabela devolve a linha. */
type AgreementRow = {
  id: string;
  subscription_id: string;
  reference: string;
  celebrated_at: string;
  plan_name: string;
  plan_features: string[] | null;
  plan_limits: Record<string, number> | null;
  addons: { slug: string; name: string; priceCents: number }[] | null;
  price_cents: number;
  price_month_cents: number;
  price_year_cents: number;
  currency: string;
  interval: "month" | "year";
  minimum_commitment_months: number | null;
  commitment_ends_at: string | null;
  terms_version: string | null;
  terms_content_hash: string | null;
  terms_accepted_at: string | null;
  terms_accepted_ip: string | null;
  provider: Record<string, string> | null;
  supersedes_id: string | null;
};

export type SubscriptionAgreement = {
  id: string;
  reference: string;
  celebratedAt: string;
  planName: string;
  planFeatures: string[];
  addons: { slug: string; name: string; priceCents: number }[];
  priceCents: number;
  priceMonthCents: number;
  priceYearCents: number;
  currency: string;
  interval: "month" | "year";
  commitmentMonths: number | null;
  commitmentEndsAt: string | null;
  terms: {
    version: string | null;
    contentHash: string | null;
    acceptedAt: string | null;
    ip: string | null;
  };
  provider: Record<string, string>;
  supersedesId: string | null;
};

/**
 * Os valores de `app_settings` chegam como JSON (`""` para um campo vazio),
 * porque a coluna é `jsonb`. Desembrulha-se aqui e não na página: um contrato
 * com aspas à volta do nome da empresa seria um erro visível ao cliente.
 */
function unwrap(provider: Record<string, unknown> | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(provider ?? {})) {
    out[key] = typeof value === "string" ? value : String(value ?? "");
  }
  return out;
}

function toAgreement(row: AgreementRow): SubscriptionAgreement {
  return {
    id: row.id,
    reference: row.reference,
    celebratedAt: row.celebrated_at,
    planName: row.plan_name,
    planFeatures: row.plan_features ?? [],
    addons: row.addons ?? [],
    priceCents: row.price_cents,
    priceMonthCents: row.price_month_cents,
    priceYearCents: row.price_year_cents,
    currency: row.currency,
    interval: row.interval,
    commitmentMonths: row.minimum_commitment_months,
    commitmentEndsAt: row.commitment_ends_at,
    terms: {
      version: row.terms_version,
      contentHash: row.terms_content_hash,
      acceptedAt: row.terms_accepted_at,
      ip: row.terms_accepted_ip,
    },
    provider: unwrap(row.provider),
    supersedesId: row.supersedes_id,
  };
}

/**
 * Os contratos do titular da sessão, do mais recente para o mais antigo.
 *
 * Vazio não é erro: significa que ainda não houve celebração — ou que a
 * subscrição é anterior a esta funcionalidade, caso em que não há contrato a
 * mostrar e a página diz isso.
 */
export async function myAgreements(client: { rpc: unknown }): Promise<SubscriptionAgreement[]> {
  const { data } = await pendingRpc<AgreementRow[]>(client, "subscription_agreements_for_me");
  return (data ?? []).map(toAgreement);
}
