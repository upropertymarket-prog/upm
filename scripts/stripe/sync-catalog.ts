#!/usr/bin/env tsx
/**
 * P7-01 — sincroniza `plans` e `addons` com o Stripe (02 §9, 07 §19.3).
 *
 * Uso:
 *   set -a && . .secrets/stripe.env && . .secrets/supabase.env && set +a
 *   pnpm stripe:sync            # aplica
 *   pnpm stripe:sync --dry-run  # mostra o que faria, sem escrever
 *
 * Precisa de NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e
 * STRIPE_SECRET_KEY no ambiente — nenhuma delas vai para o browser (08 §6.1).
 *
 * **Modo de teste.** Criar os produtos e preços reais na conta live é
 * confirmação de produção e fica para o fim do projeto (07 §16.1). O script é
 * o mesmo; só muda a chave.
 *
 * Os PREÇOS vêm da base de dados, nunca deste ficheiro. A oferta do 1.º ano
 * (`plans.intro_*`, 13 nov 2026) vira um `Coupon` por periodicidade.
 */
import { syncCatalog, type CatalogStore } from "../../packages/db/src/billing";
import {
  createCatalogStore,
  createServiceClient,
  createStripeCatalogApi,
  isTestMode,
} from "../../packages/db/src/stripe";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const client = createServiceClient();
  const api = createStripeCatalogApi();
  const real = createCatalogStore(client);

  /** Em dry-run lê a sério e não escreve nada — nem na BD, nem no Stripe. */
  const store: CatalogStore = dryRun
    ? { list: () => real.list(), saveStripeIds: async () => {} }
    : real;

  const effectiveApi = dryRun
    ? {
        ...api,
        createProduct: async (input: Parameters<typeof api.createProduct>[0]) => ({
          id: input.id,
          name: input.name,
          active: true,
          metadata: input.metadata,
        }),
        updateProduct: async (id: string, input: { name: string }) => ({
          id,
          name: input.name,
          active: true,
          metadata: {},
        }),
        createPrice: async (input: Parameters<typeof api.createPrice>[0]) => ({
          id: "(novo)",
          product: input.product,
          unitAmount: input.unitAmount,
          currency: "eur",
          interval: input.interval,
          active: true,
        }),
        createCoupon: async (input: Parameters<typeof api.createCoupon>[0]) => ({
          id: `${input.id} (novo)`,
          amountOff: input.amountOff,
          currency: "eur",
          duration: input.duration,
          durationInMonths: input.durationInMonths,
          valid: true,
        }),
      }
    : api;

  console.log(
    `Stripe: modo ${isTestMode() ? "TESTE" : "LIVE — confirmação de produção (07 §16.1)"}` +
      (dryRun ? " · dry-run, não escreve nada" : ""),
  );

  const report = await syncCatalog(effectiveApi, store);

  for (const entry of report.entries) {
    const label = `${entry.kind === "plan" ? "plano" : "extra"} ${entry.slug}`;
    if (entry.action === "skipped") {
      console.log(`  –  ${label}: ${entry.reason}`);
    } else {
      console.log(`  ${entry.action === "unchanged" ? "=" : "+"}  ${label}: ${entry.action}`);
      console.log(
        `       ${entry.productId} · mês ${entry.priceMonthId} · ano ${entry.priceYearId}`,
      );
      if (entry.couponMonthId || entry.couponYearId) {
        console.log(
          `       oferta · mês ${entry.couponMonthId ?? "—"} · ano ${entry.couponYearId ?? "—"}`,
        );
      }
    }
  }

  console.log(
    `\n${report.created} criados · ${report.pricesAdded} com preço novo · ` +
      `${report.couponsCreated} cupões novos · ` +
      `${report.unchanged} sem alterações · ${report.skipped} ignorados`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
