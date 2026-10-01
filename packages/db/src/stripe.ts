import Stripe from "stripe";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";
import {
  CATALOG_CURRENCY,
  type BillingInterval,
  type CatalogEntry,
  type CatalogPrice,
  type CatalogProduct,
  type CatalogStore,
  type StripeCatalogApi,
} from "./billing";

/**
 * Adaptador do Stripe (Fase 7, P7-01).
 * =========================================================================
 * Aqui mora tudo o que toca no SDK e na `service_role`; o algoritmo de
 * sincronização está em `billing.ts` e não conhece nenhum dos dois. Este
 * ficheiro **nunca** é importado por código de cliente — `STRIPE_SECRET_KEY`
 * e a `service_role` são de servidor (08 §6.1/§6.2).
 */

let cached: Stripe | null = null;

/**
 * Cliente Stripe. Em modo de teste enquanto a chave for `sk_test_…`; as chaves
 * live são confirmação de produção e ficam para o fim do projeto (07 §16.1).
 */
export function getStripeClient(): Stripe {
  if (cached) return cached;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "Falta STRIPE_SECRET_KEY. É uma variável de servidor — nunca com prefixo NEXT_PUBLIC_ (08 §6.1).",
    );
  }

  cached = new Stripe(key);
  return cached;
}

/** Só para os testes: esquece o cliente memorizado entre casos. */
export function resetStripeClient() {
  cached = null;
}

/** `true` quando a chave configurada é de teste. Usado nos avisos da UI. */
export function isTestMode(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_");
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "resource_missing"
  );
}

function toInterval(price: Stripe.Price): BillingInterval | null {
  const interval = price.recurring?.interval;
  if (interval === "month") return "month";
  if (interval === "year") return "year";
  return null;
}

function toCatalogPrice(price: Stripe.Price): CatalogPrice {
  return {
    id: price.id,
    product: typeof price.product === "string" ? price.product : price.product.id,
    unitAmount: price.unit_amount,
    currency: price.currency,
    interval: toInterval(price),
    active: price.active,
  };
}

function toCatalogProduct(product: Stripe.Product): CatalogProduct {
  return {
    id: product.id,
    name: product.name,
    active: product.active,
    metadata: product.metadata ?? {},
  };
}

export function createStripeCatalogApi(stripe: Stripe = getStripeClient()): StripeCatalogApi {
  return {
    async getProduct(id) {
      try {
        return toCatalogProduct(await stripe.products.retrieve(id));
      } catch (error) {
        if (isMissing(error)) return null;
        throw error;
      }
    },

    async createProduct({ id, name, metadata }) {
      // O Stripe aceita um id escolhido por nós na criação — é o que torna a
      // sincronização idempotente mesmo sem a coluna `stripe_product_id`.
      return toCatalogProduct(await stripe.products.create({ id, name, metadata }));
    },

    async updateProduct(id, { name }) {
      return toCatalogProduct(await stripe.products.update(id, { name }));
    },

    async getPrice(id) {
      try {
        return toCatalogPrice(await stripe.prices.retrieve(id));
      } catch (error) {
        if (isMissing(error)) return null;
        throw error;
      }
    },

    async createPrice({ product, unitAmount, interval, metadata }) {
      return toCatalogPrice(
        await stripe.prices.create({
          product,
          currency: CATALOG_CURRENCY,
          unit_amount: unitAmount,
          recurring: { interval },
          metadata,
        }),
      );
    },
  };
}

// ---------------------------------------------------------------------------
// O lado da base de dados
// ---------------------------------------------------------------------------

type ServiceClient = SupabaseClient<Database>;

/**
 * Cliente com `service_role`, para o script de sincronização e para o webhook.
 * Não passa por RLS — por isso só existe em contextos de servidor e nunca se
 * exporta a partir de um ficheiro que o cliente possa importar.
 */
export function createServiceClient(): ServiceClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createCatalogStore(client: ServiceClient): CatalogStore {
  return {
    async list() {
      const [plans, addons] = await Promise.all([
        client
          .from("plans")
          .select(
            "id, slug, name, price_month_cents, price_year_cents, stripe_product_id, stripe_price_month_id, stripe_price_year_id",
          )
          .eq("visible", true)
          .order("position"),
        client
          .from("addons")
          .select(
            "id, slug, name, price_month_cents, price_year_cents, stripe_product_id, stripe_price_month_id, stripe_price_year_id",
          )
          .eq("visible", true)
          .order("position"),
      ]);

      if (plans.error) throw plans.error;
      if (addons.error) throw addons.error;

      type CatalogRow = {
        id: string;
        slug: string;
        name: string;
        price_month_cents: number;
        price_year_cents: number;
        stripe_product_id: string | null;
        stripe_price_month_id: string | null;
        stripe_price_year_id: string | null;
      };

      const toEntry = (kind: "plan" | "addon") => (row: CatalogRow) => ({
        kind,
        id: row.id,
        slug: row.slug,
        name: row.name,
        priceMonthCents: Number(row.price_month_cents),
        priceYearCents: Number(row.price_year_cents),
        stripeProductId: row.stripe_product_id,
        stripePriceMonthId: row.stripe_price_month_id,
        stripePriceYearId: row.stripe_price_year_id,
      });

      return [
        ...(plans.data ?? []).map(toEntry("plan")),
        ...(addons.data ?? []).map(toEntry("addon")),
      ] satisfies CatalogEntry[];
    },

    async saveStripeIds(entry, ids) {
      const { error } = await client
        .from(entry.kind === "plan" ? "plans" : "addons")
        .update({
          stripe_product_id: ids.productId,
          stripe_price_month_id: ids.priceMonthId,
          stripe_price_year_id: ids.priceYearId,
        })
        .eq("id", entry.id);
      if (error) throw error;
    },
  };
}
