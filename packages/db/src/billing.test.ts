import { describe, expect, it } from "vitest";

import {
  CATALOG_CURRENCY,
  isNearLimit,
  isUnlimited,
  limitsSchema,
  planFormSchema,
  planLimitMessage,
  productIdFor,
  refId,
  remaining,
  secondsToIso,
  subscriptionIdFromInvoice,
  syncCatalog,
  toSubscriptionStatus,
  type CatalogEntry,
  type CatalogPrice,
  type CatalogProduct,
  type CatalogStore,
  type StripeCatalogApi,
} from "./billing";

/**
 * P7-01 — testes do algoritmo de sincronização, sem rede e sem chaves.
 * O adaptador do SDK está em `stripe.ts`; aqui o Stripe é um `Map`.
 */

function fakeStripe() {
  const products = new Map<string, CatalogProduct>();
  const prices = new Map<string, CatalogPrice>();
  let sequence = 0;

  const api: StripeCatalogApi = {
    async getProduct(id) {
      return products.get(id) ?? null;
    },
    async createProduct({ id, name, metadata }) {
      if (products.has(id)) throw new Error(`Produto duplicado: ${id}`);
      const product = { id, name, active: true, metadata };
      products.set(id, product);
      return product;
    },
    async updateProduct(id, { name }) {
      const product = products.get(id);
      if (!product) throw new Error(`Produto inexistente: ${id}`);
      const updated = { ...product, name };
      products.set(id, updated);
      return updated;
    },
    async getPrice(id) {
      return prices.get(id) ?? null;
    },
    async createPrice({ product, unitAmount, interval }) {
      sequence += 1;
      const price: CatalogPrice = {
        id: `price_${sequence}`,
        product,
        unitAmount,
        currency: CATALOG_CURRENCY,
        interval,
        active: true,
      };
      prices.set(price.id, price);
      return price;
    },
  };

  return { api, products, prices };
}

function fakeStore(rows: CatalogEntry[]) {
  const saves: { slug: string; productId: string; priceMonthId: string; priceYearId: string }[] =
    [];

  const store: CatalogStore = {
    async list() {
      return rows;
    },
    async saveStripeIds(entry, ids) {
      saves.push({ slug: entry.slug, ...ids });
      const row = rows.find((r) => r.id === entry.id)!;
      row.stripeProductId = ids.productId;
      row.stripePriceMonthId = ids.priceMonthId;
      row.stripePriceYearId = ids.priceYearId;
    },
  };

  return { store, saves };
}

function entry(partial: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    kind: "plan",
    id: "11111111-1111-4111-8111-111111111111",
    slug: "essential-owner",
    name: "Essential",
    priceMonthCents: 599,
    priceYearCents: 5990,
    stripeProductId: null,
    stripePriceMonthId: null,
    stripePriceYearId: null,
    ...partial,
  };
}

describe("limites por plano (07 §19.2)", () => {
  it("null é ilimitado, nunca um número grande", () => {
    expect(isUnlimited(null)).toBe(true);
    expect(isUnlimited(undefined)).toBe(true);
    expect(isUnlimited(0)).toBe(false);
    expect(remaining(50, null)).toBeNull();
  });

  it("não devolve restantes negativos num excedente herdado de downgrade", () => {
    expect(remaining(7, 3)).toBe(0);
    expect(remaining(1, 3)).toBe(2);
  });

  it("perto do limite é 80 % ou mais, e ilimitado nunca está perto (07 §19.4)", () => {
    expect(isNearLimit(8, 10)).toBe(true);
    expect(isNearLimit(7, 10)).toBe(false);
    expect(isNearLimit(3, 3)).toBe(true);
    expect(isNearLimit(999, null)).toBe(false);
    // Cloud a 0 GB no Gratuito: isso não é estar perto, é não ter.
    expect(isNearLimit(0, 0)).toBe(false);
  });

  it("aceita a grelha de 07 §19.2 tal como está no seed", () => {
    const premium = limitsSchema.parse({
      active_properties: null,
      visits: null,
      active_chats: null,
      saved: null,
      alerts: 20,
      cloud_gb: 20,
    });
    expect(premium.alerts).toBe(20);
    expect(premium.active_properties).toBeNull();

    // Um plano de comprador não tem a chave de imóveis — e isso é válido.
    expect(limitsSchema.parse({ saved: 100, alerts: 5 }).active_properties).toBeUndefined();
    expect(() => limitsSchema.parse({ saved: -1 })).toThrow();
  });
});

describe("o que vem do Stripe (P7-03)", () => {
  it("traduz os estados de subscrição para os de 05 §6.6", () => {
    expect(toSubscriptionStatus("active")).toBe("active");
    expect(toSubscriptionStatus("trialing")).toBe("trialing");
    expect(toSubscriptionStatus("past_due")).toBe("past_due");
    // Tudo o que deixou de dar direito a seja o que for é o mesmo estado.
    expect(toSubscriptionStatus("unpaid")).toBe("canceled");
    expect(toSubscriptionStatus("incomplete_expired")).toBe("canceled");
    expect(toSubscriptionStatus("paused")).toBe("canceled");
    // Um estado que o Stripe acrescente amanhã não vira "active" por engano.
    expect(toSubscriptionStatus("qualquer_coisa_nova")).toBe("incomplete");
  });

  it("converte segundos em ISO e trata o nulo", () => {
    expect(secondsToIso(0)).toBeNull();
    expect(secondsToIso(null)).toBeNull();
    expect(secondsToIso(1_790_000_000)).toBe(new Date(1_790_000_000_000).toISOString());
  });

  it("lê um id venha ele como string ou como objeto", () => {
    expect(refId("cus_123")).toBe("cus_123");
    expect(refId({ id: "cus_123" })).toBe("cus_123");
    expect(refId(null)).toBeNull();
  });

  it("encontra a subscrição da fatura nos dois sítios onde o Stripe já a pôs", () => {
    expect(subscriptionIdFromInvoice({ subscription: "sub_1" })).toBe("sub_1");
    expect(subscriptionIdFromInvoice({ lines: { data: [{ subscription: "sub_2" }] } })).toBe(
      "sub_2",
    );
    expect(subscriptionIdFromInvoice({ lines: { data: [{}] } })).toBeNull();
    expect(subscriptionIdFromInvoice({})).toBeNull();
  });
});

describe("recusa por limite de plano (P7-03)", () => {
  it("traduz a chave do gatilho em mensagem, e só a do gatilho", () => {
    expect(planLimitMessage({ code: "P0001", hint: "saved" })).toContain("guardados");
    expect(planLimitMessage({ code: "P0001", hint: "active_properties" })).toContain("publicados");
    // Um erro qualquer do Postgres não vira "chegou ao limite".
    expect(planLimitMessage({ code: "23505", hint: "saved" })).toBeNull();
    expect(planLimitMessage({ code: "P0001", hint: "coisa_que_nao_existe" })).toBeNull();
    expect(planLimitMessage(null)).toBeNull();
  });
});

describe("modal de plano do Admin (P7-05)", () => {
  const base = {
    slug: "smarter-owner",
    name: "Smarter",
    audience: "owner" as const,
    priceMonthCents: 1299,
    priceYearCents: 12990,
    features: ["Destaque no Market"],
    visible: true,
  };

  it("um limite vazio grava-se como ilimitado, nunca como um número grande", () => {
    const parsed = planFormSchema.parse({
      ...base,
      limits: { active_properties: null, saved: 200, cloud_gb: 5 },
    });
    expect(parsed.limits.active_properties).toBeNull();
    expect(parsed.limits.saved).toBe(200);
  });

  it("recusa slug com maiúsculas ou espaços, e preços negativos", () => {
    expect(() => planFormSchema.parse({ ...base, slug: "Smarter Owner", limits: {} })).toThrow();
    expect(() => planFormSchema.parse({ ...base, priceMonthCents: -1, limits: {} })).toThrow();
  });
});

describe("syncCatalog (P7-01)", () => {
  it("cria produto e os dois preços na primeira corrida", async () => {
    const { api, products, prices } = fakeStripe();
    const { store, saves } = fakeStore([entry()]);

    const report = await syncCatalog(api, store);

    expect(report.created).toBe(1);
    expect(products.size).toBe(1);
    expect(prices.size).toBe(2);
    expect(saves).toHaveLength(1);
    expect(saves[0]!.productId).toBe("upm_plan_essential-owner");

    const amounts = [...prices.values()].map((p) => p.unitAmount).sort((a, b) => a! - b!);
    expect(amounts).toEqual([599, 5990]);
  });

  it("correr duas vezes não duplica nada", async () => {
    const { api, products, prices } = fakeStripe();
    const { store, saves } = fakeStore([entry()]);

    await syncCatalog(api, store);
    const second = await syncCatalog(api, store);

    expect(products.size).toBe(1);
    expect(prices.size).toBe(2);
    expect(second.unchanged).toBe(1);
    expect(second.created).toBe(0);
    // A segunda corrida não escreve na base de dados: nada mudou.
    expect(saves).toHaveLength(1);
  });

  it("mudar um preço cria um Price novo e não toca no antigo (02 §9)", async () => {
    const { api, prices } = fakeStripe();
    const row = entry();
    const { store } = fakeStore([row]);

    await syncCatalog(api, store);
    const oldMonthId = row.stripePriceMonthId!;
    const oldMonth = { ...prices.get(oldMonthId)! };

    row.priceMonthCents = 699;
    const report = await syncCatalog(api, store);

    expect(report.pricesAdded).toBe(1);
    expect(prices.size).toBe(3);
    expect(row.stripePriceMonthId).not.toBe(oldMonthId);
    expect(prices.get(row.stripePriceMonthId!)!.unitAmount).toBe(699);
    // O antigo continua exatamente como estava, ativo, a servir quem o subscreveu.
    expect(prices.get(oldMonthId)).toEqual(oldMonth);
    expect(prices.get(oldMonthId)!.active).toBe(true);
    // O anual não mudou de preço: fica o mesmo objeto.
    expect(prices.get(row.stripePriceYearId!)!.unitAmount).toBe(5990);
  });

  it("salta o Gratuito — não há o que cobrar", async () => {
    const { api, products } = fakeStripe();
    const { store, saves } = fakeStore([
      entry({ slug: "gratuito", name: "Gratuito", priceMonthCents: 0, priceYearCents: 0 }),
    ]);

    const report = await syncCatalog(api, store);

    expect(report.skipped).toBe(1);
    expect(products.size).toBe(0);
    expect(saves).toHaveLength(0);
  });

  it("leva também os extras, com id próprio (07 §19.3)", async () => {
    const { api, products } = fakeStripe();
    const { store } = fakeStore([
      entry({
        kind: "addon",
        id: "22222222-2222-4222-8222-222222222222",
        slug: "cloud-5gb",
        name: "Cloud 5 GB",
        priceMonthCents: 299,
        priceYearCents: 2990,
      }),
    ]);

    await syncCatalog(api, store);

    expect([...products.keys()]).toEqual(["upm_addon_cloud-5gb"]);
    expect(productIdFor({ kind: "addon", slug: "cloud-5gb" })).toBe("upm_addon_cloud-5gb");
  });

  it("recria o produto se o id guardado já não existir no Stripe", async () => {
    const { api, products } = fakeStripe();
    const { store } = fakeStore([entry({ stripeProductId: "prod_de_outra_conta" })]);

    const report = await syncCatalog(api, store);

    expect(report.created).toBe(1);
    // Não reaproveita o id morto: volta ao determinístico.
    expect(products.has("prod_de_outra_conta")).toBe(false);
    expect(products.has("upm_plan_essential-owner")).toBe(true);
  });

  it("renomear um plano atualiza o produto sem criar preços novos", async () => {
    const { api, prices } = fakeStripe();
    const row = entry();
    const { store } = fakeStore([row]);

    await syncCatalog(api, store);
    row.name = "Essential Proprietário";
    const report = await syncCatalog(api, store);

    expect(report.entries[0]!.action).toBe("renamed");
    expect(prices.size).toBe(2);
  });
});
