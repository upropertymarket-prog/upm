import { z } from "zod";

/**
 * Faturação (Fase 7) — 05 §6.6, 02 §9, 07 §8.3, 07 §19.2 e §19.3.
 * =========================================================================
 * Este ficheiro é a camada de domínio: limites, intervalos, estados e o
 * algoritmo de sincronização do catálogo. **Não importa o SDK do Stripe** —
 * o adaptador vive em `stripe.ts`. É essa separação que deixa o algoritmo ser
 * testado sem rede e sem chaves.
 *
 * Duas regras que vêm dos documentos e não se negoceiam:
 *
 * 1. **Os preços vivem na base de dados**, em `plans`/`addons` — nunca em
 *    código. A grelha de 07 §8.3 é PROVISÓRIA (07 §9 #2 continua aberta) e
 *    um preço escrito à mão num ecrã é exatamente a forma de a tornar
 *    definitiva sem ninguém decidir nada.
 * 2. **Um `Price` do Stripe nunca se edita** (02 §9). Preço novo = `Price`
 *    novo; a coluna passa a apontar para o novo e o antigo continua a servir
 *    quem já o subscreveu.
 */

// ---------------------------------------------------------------------------
// Limites por plano — 07 §19.2
// ---------------------------------------------------------------------------

/**
 * As seis chaves de `plans.limits`. A ordem é a da grelha de 07 §19.2 e é a
 * que o Admin mostra no modal de edição (P7-05).
 */
export const LIMIT_KEYS = [
  "active_properties",
  "visits",
  "active_chats",
  "saved",
  "alerts",
  "cloud_gb",
] as const;
export type LimitKey = (typeof LIMIT_KEYS)[number];

export const LIMIT_LABELS: Record<LimitKey, string> = {
  active_properties: "Imóveis ativos",
  visits: "Pedidos de visita por mês",
  active_chats: "Conversas ativas",
  saved: "Imóveis guardados",
  alerts: "Alertas de pesquisa",
  cloud_gb: "Cloud (GB)",
};

/**
 * `null` significa ILIMITADO (07 §19.2: "grava-se como `null` na chave, nunca
 * como um número grande"). Uma chave ausente lê-se como ilimitada também —
 * é o caso de `active_properties` nos planos de comprador, que não publicam.
 */
export const limitsSchema = z.object({
  active_properties: z.number().int().nonnegative().nullable().optional(),
  visits: z.number().int().nonnegative().nullable().optional(),
  active_chats: z.number().int().nonnegative().nullable().optional(),
  saved: z.number().int().nonnegative().nullable().optional(),
  alerts: z.number().int().nonnegative().nullable().optional(),
  cloud_gb: z.number().int().nonnegative().nullable().optional(),
});
export type PlanLimits = z.infer<typeof limitsSchema>;

/** Ilimitado é `null`, `undefined` ou uma chave que não existe no objeto. */
export function isUnlimited(limit: number | null | undefined): limit is null | undefined {
  return limit === null || limit === undefined;
}

/**
 * Quanto falta para o limite. `null` = sem limite. Nunca devolve negativo:
 * um excedente herdado de um downgrade (02 §9) conta como zero restantes, não
 * como dívida.
 */
export function remaining(used: number, limit: number | null | undefined): number | null {
  if (isUnlimited(limit)) return null;
  return Math.max(0, limit - used);
}

/**
 * 07 §19.4 — "próximo do limite" é 80 % ou mais. Ilimitado nunca aproxima
 * ninguém de limite nenhum; limite zero (ex.: Cloud no Gratuito) também não,
 * porque isso não é estar perto, é não ter.
 *
 * A mesma regra existe em SQL (`at_limit_ratio`, migração da Fase 6). As duas
 * têm de dizer o mesmo — `billing.test.ts` vigia este lado.
 */
export const NEAR_LIMIT_RATIO = 0.8;

export function isNearLimit(used: number, limit: number | null | undefined): boolean {
  if (isUnlimited(limit) || limit <= 0) return false;
  return used / limit >= NEAR_LIMIT_RATIO;
}

/**
 * O que se diz a quem bate num limite. 07 §19.8 #1: nunca truncar em
 * silêncio — a recusa explica-se, e aponta para onde se resolve.
 *
 * O gatilho `enforce_plan_limit` (migração `20261001120100`) devolve a chave
 * no `hint`, por isso não é preciso analisar texto de erro para saber qual
 * dos limites foi.
 */
export const LIMIT_REACHED_MESSAGE: Record<LimitKey, string> = {
  active_properties:
    "Chegou ao limite de imóveis publicados do seu plano. Veja os planos para publicar mais.",
  visits: "Chegou ao limite de pedidos de visita deste mês. Veja os planos para pedir mais.",
  active_chats:
    "Chegou ao limite de conversas do seu plano. Veja os planos para falar com mais pessoas.",
  saved: "Chegou ao limite de imóveis guardados do seu plano. Veja os planos para guardar mais.",
  alerts: "Chegou ao limite de alertas do seu plano. Veja os planos para criar mais.",
  cloud_gb: "Não há espaço na sua Cloud. Veja os planos para aumentar o armazenamento.",
};

/**
 * Traduz um erro do Postgres em mensagem de limite, ou `null` se não for um.
 * Serve para a Server Action não ter de distinguir "falhou porque o plano
 * acabou" de "falhou porque alguma coisa correu mal" — são respostas
 * diferentes para o utilizador.
 */
export function planLimitMessage(
  error: { code?: string | null; hint?: string | null } | null | undefined,
): string | null {
  if (!error || error.code !== "P0001") return null;
  const key = error.hint as LimitKey | undefined | null;
  return key && key in LIMIT_REACHED_MESSAGE ? LIMIT_REACHED_MESSAGE[key] : null;
}

// ---------------------------------------------------------------------------
// Intervalos e estados — 05 §6.6
// ---------------------------------------------------------------------------

export const BILLING_INTERVALS = ["month", "year"] as const;
export const billingIntervalSchema = z.enum(BILLING_INTERVALS);
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const BILLING_INTERVAL_LABELS: Record<BillingInterval, string> = {
  month: "Mensal",
  year: "Anual",
};

/** Os mesmos valores do `check` de `subscriptions.status` (Fase 2). */
export const SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "canceled",
  "incomplete",
] as const;
export const subscriptionStatusSchema = z.enum(SUBSCRIPTION_STATUSES);
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Estados em que a subscrição dá direito aos limites do plano. */
export const ENTITLED_STATUSES: readonly SubscriptionStatus[] = ["active", "trialing"];

export function isEntitled(status: SubscriptionStatus): boolean {
  return ENTITLED_STATUSES.includes(status);
}

// ---------------------------------------------------------------------------
// Entradas validadas — P7-02, P7-04 e P7-05
//
// Os schemas vivem aqui e não nas apps, como os de `properties.ts` e
// `cloud.ts`: é o que mantém a validação igual nos três sítios que a usam e
// o `zod` como dependência de um pacote só.
// ---------------------------------------------------------------------------

/** O que o cliente pode pedir no Checkout. O PREÇO nunca vem daqui. */
export const checkoutSchema = z.object({
  kind: z.enum(["plan", "addon"]),
  slug: z.string().min(1).max(64),
  interval: z.enum(BILLING_INTERVALS),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const invoiceIdSchema = z.string().uuid();

/** Modal de criar/editar plano do Admin (P7-05, 04 §8.5). */
export const planFormSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "O slug usa só minúsculas, números e hífenes."),
  name: z.string().trim().min(2).max(80),
  audience: z.enum(["owner", "buyer", "both"]),
  priceMonthCents: z.number().int().min(0).max(1_000_000),
  priceYearCents: z.number().int().min(0).max(10_000_000),
  features: z.array(z.string().trim().min(1).max(120)).max(12),
  limits: limitsSchema,
  visible: z.boolean(),
});
export type PlanFormInput = z.infer<typeof planFormSchema>;

// ---------------------------------------------------------------------------
// Tradução do que vem do Stripe — P7-03
//
// Puras de propósito: é a parte do webhook que mais vale a pena testar, e
// testá-la não devia obrigar a montar um servidor nem a assinar um evento.
// ---------------------------------------------------------------------------

/** Os estados do Stripe não são os de `subscriptions` (05 §6.6). */
export function toSubscriptionStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "active":
    case "trialing":
    case "past_due":
    case "incomplete":
      return status;
    // `unpaid`, `incomplete_expired` e `paused` não dão direito a nada; para
    // o produto são todos o mesmo: a subscrição deixou de valer.
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
    case "paused":
      return "canceled";
    default:
      return "incomplete";
  }
}

/** O Stripe conta o tempo em segundos; a base de dados em `timestamptz`. */
export function secondsToIso(value: number | null | undefined): string | null {
  return value ? new Date(value * 1000).toISOString() : null;
}

type MaybeRef = string | { id: string } | null | undefined;

export function refId(value: MaybeRef): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/**
 * `invoice.subscription` mudou de sítio entre versões da API (passou a viver
 * nas linhas da fatura). Lê-se dos dois sítios, para uma atualização da
 * biblioteca não partir a ligação fatura ↔ subscrição em silêncio.
 */
export function subscriptionIdFromInvoice(invoice: {
  subscription?: MaybeRef;
  lines?: { data?: { subscription?: MaybeRef }[] };
}): string | null {
  const direct = refId(invoice.subscription);
  if (direct) return direct;
  for (const line of invoice.lines?.data ?? []) {
    const parent = refId(line.subscription);
    if (parent) return parent;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sincronização do catálogo ↔ Stripe — P7-01
// ---------------------------------------------------------------------------

/** O que uma linha de `plans` ou `addons` tem de ter para ir ao Stripe. */
export type CatalogEntry = {
  kind: "plan" | "addon";
  id: string;
  slug: string;
  name: string;
  priceMonthCents: number;
  priceYearCents: number;
  stripeProductId: string | null;
  stripePriceMonthId: string | null;
  stripePriceYearId: string | null;
};

export type CatalogProduct = {
  id: string;
  name: string;
  active: boolean;
  metadata: Record<string, string>;
};

export type CatalogPrice = {
  id: string;
  product: string;
  unitAmount: number | null;
  currency: string;
  interval: BillingInterval | null;
  active: boolean;
};

/**
 * O mínimo do Stripe de que a sincronização precisa. `stripe.ts` implementa
 * isto sobre o SDK; os testes implementam-no sobre um `Map`.
 *
 * `getProduct`/`getPrice` devolvem `null` quando o objeto não existe, em vez
 * de atirar — um id guardado que entretanto desapareceu do Stripe é um caso
 * normal (mudança de conta, modo de teste limpo), não um erro.
 */
export type StripeCatalogApi = {
  getProduct(id: string): Promise<CatalogProduct | null>;
  createProduct(input: {
    id: string;
    name: string;
    metadata: Record<string, string>;
  }): Promise<CatalogProduct>;
  updateProduct(id: string, input: { name: string }): Promise<CatalogProduct>;
  getPrice(id: string): Promise<CatalogPrice | null>;
  createPrice(input: {
    product: string;
    unitAmount: number;
    interval: BillingInterval;
    metadata: Record<string, string>;
  }): Promise<CatalogPrice>;
};

/** O lado da base de dados. Implementado em `stripe.ts` sobre a service role. */
export type CatalogStore = {
  list(): Promise<CatalogEntry[]>;
  saveStripeIds(
    entry: CatalogEntry,
    ids: { productId: string; priceMonthId: string; priceYearId: string },
  ): Promise<void>;
};

export const CATALOG_CURRENCY = "eur";

/**
 * Id determinístico do `Product`. É o que torna a sincronização idempotente
 * mesmo que a coluna `stripe_product_id` se perca: o Stripe aceita um id
 * escolhido por nós na criação, e uma segunda corrida encontra o mesmo objeto
 * em vez de criar um gémeo.
 */
export function productIdFor(entry: Pick<CatalogEntry, "kind" | "slug">): string {
  return `upm_${entry.kind}_${entry.slug}`;
}

export type SyncAction = "created" | "price_added" | "renamed" | "unchanged" | "skipped";

export type SyncEntryResult = {
  slug: string;
  kind: "plan" | "addon";
  action: SyncAction;
  reason?: string;
  productId?: string;
  priceMonthId?: string;
  priceYearId?: string;
};

export type SyncReport = {
  entries: SyncEntryResult[];
  created: number;
  pricesAdded: number;
  unchanged: number;
  skipped: number;
};

/** Um preço serve se existe, está ativo, é em euros e tem o valor pedido. */
function priceMatches(
  price: CatalogPrice | null,
  unitAmount: number,
  interval: BillingInterval,
): price is CatalogPrice {
  return (
    price !== null &&
    price.active &&
    price.currency === CATALOG_CURRENCY &&
    price.interval === interval &&
    price.unitAmount === unitAmount
  );
}

/**
 * Leva `plans` e `addons` para o Stripe.
 *
 * O que NÃO faz, e é deliberado:
 *
 * - **Não desativa o `Price` antigo.** 02 §9 diz que um `Price` existente não
 *   se edita, e desativar é uma escrita nele. Não é preciso: o Checkout usa
 *   sempre o id que está na coluna, por isso o antigo deixa de estar
 *   alcançável para subscrições novas e continua a servir as que existem.
 * - **Não leva o plano Gratuito** nem nada a 0 €: não há o que cobrar, e um
 *   `Price` a zero só traria um objeto morto ao catálogo.
 */
export async function syncCatalog(api: StripeCatalogApi, store: CatalogStore): Promise<SyncReport> {
  const entries = await store.list();
  const results: SyncEntryResult[] = [];

  for (const entry of entries) {
    if (entry.priceMonthCents <= 0 && entry.priceYearCents <= 0) {
      results.push({
        slug: entry.slug,
        kind: entry.kind,
        action: "skipped",
        reason: "Gratuito — nada a cobrar.",
      });
      continue;
    }

    const metadata = { upm_kind: entry.kind, upm_slug: entry.slug };
    let action: SyncAction = "unchanged";

    // Primeiro o id que a base de dados guarda; se já não resolver (conta
    // diferente, modo de teste limpo), o id determinístico. Só depois se cria.
    let product = entry.stripeProductId ? await api.getProduct(entry.stripeProductId) : null;

    if (!product) {
      const canonical = productIdFor(entry);
      product = await api.getProduct(canonical);
      if (!product) {
        product = await api.createProduct({ id: canonical, name: entry.name, metadata });
        action = "created";
      }
    }

    if (action !== "created" && product.name !== entry.name) {
      product = await api.updateProduct(product.id, { name: entry.name });
      action = "renamed";
    }

    const wanted: { interval: BillingInterval; cents: number; current: string | null }[] = [
      { interval: "month", cents: entry.priceMonthCents, current: entry.stripePriceMonthId },
      { interval: "year", cents: entry.priceYearCents, current: entry.stripePriceYearId },
    ];

    const priceIds: Record<BillingInterval, string> = { month: "", year: "" };

    for (const { interval, cents, current } of wanted) {
      const existing = current ? await api.getPrice(current) : null;

      if (priceMatches(existing, cents, interval) && existing.product === product.id) {
        priceIds[interval] = existing.id;
        continue;
      }

      const created = await api.createPrice({
        product: product.id,
        unitAmount: cents,
        interval,
        metadata,
      });
      priceIds[interval] = created.id;
      if (action === "unchanged") action = "price_added";
    }

    const changed =
      action !== "unchanged" ||
      entry.stripeProductId !== product.id ||
      entry.stripePriceMonthId !== priceIds.month ||
      entry.stripePriceYearId !== priceIds.year;

    if (changed) {
      await store.saveStripeIds(entry, {
        productId: product.id,
        priceMonthId: priceIds.month,
        priceYearId: priceIds.year,
      });
    }

    results.push({
      slug: entry.slug,
      kind: entry.kind,
      action,
      productId: product.id,
      priceMonthId: priceIds.month,
      priceYearId: priceIds.year,
    });
  }

  return {
    entries: results,
    created: results.filter((r) => r.action === "created").length,
    pricesAdded: results.filter((r) => r.action === "price_added").length,
    unchanged: results.filter((r) => r.action === "unchanged").length,
    skipped: results.filter((r) => r.action === "skipped").length,
  };
}
