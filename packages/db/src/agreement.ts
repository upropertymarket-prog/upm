import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

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

type AnySupabaseClient = SupabaseClient<Database>;

/**
 * A forma em que a tabela devolve a linha — **derivada dos tipos gerados**, não
 * escrita à mão. Até 7 out 2026 era uma cópia manual, por os tipos não terem
 * ainda esta função; uma cópia que concordasse com o SQL por coincidência é
 * exatamente o que D52 veio apagar.
 *
 * O que fica por fazer à mão é só o estreitamento: `jsonb` chega como `Json` e
 * `inet` como `unknown`, e é aqui — não na página — que isso ganha forma.
 */
type AgreementRow =
  Database["public"]["Functions"]["subscription_agreements_for_me"]["Returns"][number];

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
function unwrap(provider: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!provider || typeof provider !== "object" || Array.isArray(provider)) return out;
  for (const [key, value] of Object.entries(provider)) {
    out[key] = typeof value === "string" ? value : String(value ?? "");
  }
  return out;
}

/** `addons` é `jsonb` e pode vir `null`, `[]` ou a lista. Nada mais é aceite. */
function toAddons(raw: unknown): SubscriptionAgreement["addons"] {
  if (!Array.isArray(raw)) return [];
  return raw as SubscriptionAgreement["addons"];
}

/** A coluna `interval` é texto no SQL; aqui só existem dois valores. */
function toInterval(raw: string): "month" | "year" {
  return raw === "month" ? "month" : "year";
}

function toAgreement(row: AgreementRow): SubscriptionAgreement {
  return {
    id: row.id,
    reference: row.reference,
    celebratedAt: row.celebrated_at,
    planName: row.plan_name,
    planFeatures: row.plan_features,
    addons: toAddons(row.addons),
    priceCents: row.price_cents,
    priceMonthCents: row.price_month_cents,
    priceYearCents: row.price_year_cents,
    currency: row.currency,
    interval: toInterval(row.interval),
    commitmentMonths: row.minimum_commitment_months,
    commitmentEndsAt: row.commitment_ends_at,
    terms: {
      version: row.terms_version,
      contentHash: row.terms_content_hash,
      acceptedAt: row.terms_accepted_at,
      // `inet` chega como `unknown` dos tipos gerados.
      ip: typeof row.terms_accepted_ip === "string" ? row.terms_accepted_ip : null,
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
export async function myAgreements(client: AnySupabaseClient): Promise<SubscriptionAgreement[]> {
  const { data } = await client.rpc("subscription_agreements_for_me");
  return (data ?? []).map(toAgreement);
}
