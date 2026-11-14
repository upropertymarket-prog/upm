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

/**
 * Os nomes dos limites estão em `plan.limits.*` nas mensagens. Houve aqui um
 * `LIMIT_LABELS` com as mesmas seis frases em português, e a 20 out 2026
 * descobriu-se que **ninguém o importava** — as chaves de `plan.limits` já
 * existiam e os ecrãs sempre leram de lá. Um mapa de rótulos morto num pacote
 * de base de dados é pior do que inútil: convida o próximo a usá-lo e a pôr
 * português num ecrã inglês.
 */

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

/** "Mensal"/"Anual" estão em `plan.interval.*`; o mapa que aqui estava também não tinha quem o importasse. */

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

/**
 * O que o cliente pode pedir no Checkout. O PREÇO nunca vem daqui.
 *
 * Fase 9 (P9-02/P9-09): contratar um plano leva a versão dos Termos que foi
 * mostrada. Não é o cliente a escolher o que aceita — o servidor compara com o
 * documento publicado e recusa se não for o mesmo; o que estes dois campos
 * fazem é provar QUAL foi mostrado. Para um extra ficam vazios: um extra soma-se
 * a uma subscrição que já tem contrato (07 §19.3).
 */
export const checkoutSchema = z.object({
  kind: z.enum(["plan", "addon"]),
  slug: z.string().min(1).max(64),
  interval: z.enum(BILLING_INTERVALS),
  termsDocumentId: z.string().uuid().optional(),
  termsContentHash: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .optional(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const invoiceIdSchema = z.string().uuid();

/** 07 §8.1 — 7 dias, uma vez por perfil, e mais 7 se a extensão for aprovada. */
export const TRIAL_DAYS = 7;

/**
 * A justificação do pedido de extensão. O mínimo não é capricho: "preciso de
 * mais tempo" não dá a quem decide nada em que se apoiar, e é uma única vez.
 */
export const trialReasonSchema = z
  .string()
  .trim()
  .min(10, "Escreva pelo menos uma frase a justificar o pedido.")
  .max(1000);

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
  /**
   * A oferta de entrada (13 nov 2026). `null` nos três = sem oferta, que é o
   * caso dos extras e dos planos de comprador. Ver `introCouponFor`.
   */
  introMonthCents: number | null;
  introYearCents: number | null;
  introMonths: number | null;
  stripeCouponMonthId: string | null;
  stripeCouponYearId: string | null;
};

/**
 * Um `Coupon` do Stripe, no mínimo de que a sincronização precisa. Como o
 * `Price`, um cupão não se edita: valor ou duração novos = cupão novo.
 */
export type CatalogCoupon = {
  id: string;
  amountOff: number | null;
  currency: string | null;
  duration: "once" | "repeating" | "forever";
  durationInMonths: number | null;
  valid: boolean;
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
  /** Os preços ativos de um produto, para reaproveitar em vez de duplicar. */
  listPrices(product: string): Promise<CatalogPrice[]>;
  createPrice(input: {
    product: string;
    unitAmount: number;
    interval: BillingInterval;
    metadata: Record<string, string>;
  }): Promise<CatalogPrice>;
  getCoupon(id: string): Promise<CatalogCoupon | null>;
  createCoupon(input: {
    id: string;
    name: string;
    amountOff: number;
    duration: "once" | "repeating";
    durationInMonths: number | null;
    product: string;
    metadata: Record<string, string>;
  }): Promise<CatalogCoupon>;
};

export type CatalogStripeIds = {
  productId: string;
  priceMonthId: string;
  priceYearId: string;
  couponMonthId: string | null;
  couponYearId: string | null;
};

/** O lado da base de dados. Implementado em `stripe.ts` sobre a service role. */
export type CatalogStore = {
  list(): Promise<CatalogEntry[]>;
  saveStripeIds(entry: CatalogEntry, ids: CatalogStripeIds): Promise<void>;
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

/**
 * O cupão que aplica a oferta de entrada a uma periodicidade, ou `null` se o
 * plano não tem oferta.
 *
 * Desconta a DIFERENÇA para o preço normal, não uma percentagem: o que o
 * cliente decidiu foram valores (10,99 em vez de 19,99), e uma percentagem
 * arredondada dava cêntimos de diferença na fatura.
 *
 * - **Mensal:** `repeating` durante `introMonths` faturas.
 * - **Anual:** `once` — a primeira anuidade são os primeiros 12 meses. Só é
 *   assim enquanto `introMonths` for 12; outro valor no anual não tem tradução
 *   honesta num cupão, e recusa-se em vez de se aproximar.
 *
 * O id é determinístico e leva o valor e a duração, pela mesma razão que o do
 * `Product`: uma segunda corrida encontra o mesmo cupão, e uma oferta nova
 * nunca reaproveita um cupão com outro valor.
 */
export function introCouponFor(
  entry: Pick<
    CatalogEntry,
    | "slug"
    | "priceMonthCents"
    | "priceYearCents"
    | "introMonthCents"
    | "introYearCents"
    | "introMonths"
  >,
  interval: BillingInterval,
): {
  id: string;
  amountOff: number;
  duration: "once" | "repeating";
  durationInMonths: number | null;
} | null {
  const intro = interval === "month" ? entry.introMonthCents : entry.introYearCents;
  const price = interval === "month" ? entry.priceMonthCents : entry.priceYearCents;
  const months = entry.introMonths;
  if (intro === null || months === null) return null;

  const amountOff = price - intro;
  if (amountOff <= 0 || intro <= 0) {
    throw new Error(`${entry.slug}: a oferta (${intro}) não fica abaixo do preço (${price}).`);
  }
  if (interval === "year" && months !== 12) {
    throw new Error(
      `${entry.slug}: oferta de ${months} meses no anual — um cupão só cobre anuidades inteiras.`,
    );
  }

  return {
    id: `upm_intro_${entry.slug}_${interval}_${amountOff}_${months}m`,
    amountOff,
    duration: interval === "month" ? "repeating" : "once",
    durationInMonths: interval === "month" ? months : null,
  };
}

/** O Stripe mostra o nome do cupão na fatura e no Checkout; o limite é 40. */
function couponName(planName: string, interval: BillingInterval): string {
  return `${planName} · oferta 1.º ${interval === "month" ? "ano (mensal)" : "ano"}`.slice(0, 40);
}

function couponMatches(
  coupon: CatalogCoupon | null,
  wanted: NonNullable<ReturnType<typeof introCouponFor>>,
): coupon is CatalogCoupon {
  return (
    coupon !== null &&
    coupon.valid &&
    coupon.currency === CATALOG_CURRENCY &&
    coupon.amountOff === wanted.amountOff &&
    coupon.duration === wanted.duration &&
    coupon.durationInMonths === wanted.durationInMonths
  );
}

export type SyncAction =
  "created" | "price_added" | "price_reused" | "renamed" | "unchanged" | "skipped";

export type SyncEntryResult = {
  slug: string;
  kind: "plan" | "addon";
  action: SyncAction;
  reason?: string;
  productId?: string;
  priceMonthId?: string;
  priceYearId?: string;
  couponMonthId?: string | null;
  couponYearId?: string | null;
};

export type SyncReport = {
  entries: SyncEntryResult[];
  couponsCreated: number;
  created: number;
  pricesAdded: number;
  pricesReused: number;
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
  let couponsCreated = 0;

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

      // Antes de criar: já há um `Price` idêntico neste produto? Um `Price` do
      // Stripe é imutável, por isso reaproveitar um igual é seguro — e evita
      // encher o catálogo de gémeos quando um preço volta a um valor anterior.
      const reusable = (await api.listPrices(product.id)).find((price) =>
        priceMatches(price, cents, interval),
      );

      if (reusable) {
        priceIds[interval] = reusable.id;
        if (action === "unchanged") action = "price_reused";
        continue;
      }

      const created = await api.createPrice({
        product: product.id,
        unitAmount: cents,
        interval,
        metadata,
      });
      priceIds[interval] = created.id;
      if (action === "unchanged" || action === "price_reused") action = "price_added";
    }

    // A oferta de entrada. Sem oferta, a coluna fica `null` — é isso que tira o
    // desconto do Checkout quando o Admin acaba com ela, sem tocar no cupão,
    // que continua a servir quem já o apanhou.
    const couponIds: Record<BillingInterval, string | null> = { month: null, year: null };

    for (const interval of BILLING_INTERVALS) {
      const wanted = introCouponFor(entry, interval);
      if (!wanted) continue;

      const existing = await api.getCoupon(wanted.id);
      if (couponMatches(existing, wanted)) {
        couponIds[interval] = existing.id;
        continue;
      }
      if (existing) {
        // Mesmo id, outro conteúdo: alguém mexeu no cupão à mão no Stripe. Não
        // se apaga nem se inventa um id ao lado — pára-se, para alguém ver.
        throw new Error(`${entry.slug}: o cupão ${wanted.id} existe no Stripe com outro valor.`);
      }

      const created = await api.createCoupon({
        id: wanted.id,
        name: couponName(entry.name, interval),
        amountOff: wanted.amountOff,
        duration: wanted.duration,
        durationInMonths: wanted.durationInMonths,
        product: product.id,
        metadata,
      });
      couponIds[interval] = created.id;
      couponsCreated += 1;
    }

    const changed =
      action !== "unchanged" ||
      entry.stripeProductId !== product.id ||
      entry.stripePriceMonthId !== priceIds.month ||
      entry.stripePriceYearId !== priceIds.year ||
      entry.stripeCouponMonthId !== couponIds.month ||
      entry.stripeCouponYearId !== couponIds.year;

    if (changed) {
      await store.saveStripeIds(entry, {
        productId: product.id,
        priceMonthId: priceIds.month,
        priceYearId: priceIds.year,
        couponMonthId: couponIds.month,
        couponYearId: couponIds.year,
      });
    }

    results.push({
      slug: entry.slug,
      kind: entry.kind,
      action,
      productId: product.id,
      priceMonthId: priceIds.month,
      priceYearId: priceIds.year,
      couponMonthId: couponIds.month,
      couponYearId: couponIds.year,
    });
  }

  return {
    entries: results,
    couponsCreated,
    created: results.filter((r) => r.action === "created").length,
    pricesAdded: results.filter((r) => r.action === "price_added").length,
    pricesReused: results.filter((r) => r.action === "price_reused").length,
    unchanged: results.filter((r) => r.action === "unchanged").length,
    skipped: results.filter((r) => r.action === "skipped").length,
  };
}
