import { getLocale } from "next-intl/server";

import { buildMetadata } from "@/lib/seo";
import { seo } from "./seo";

import { HomeSections } from "../components/site/HomeSections";
import { getLaunchMode } from "../lib/launch-mode";
import { getPublicPlans } from "../lib/public-plans";
import { setLocalePreference } from "./actions/preferences";

/** Metadados a partir do `seo.ts` desta rota (P2-06). */
export function generateMetadata() {
  return buildMetadata(seo, "/");
}

/**
 * Home do site público — `/` (P2-01 · 04 §2.1)
 * =========================================================================
 * Substitui o ecrã de verificação da Fase 1, que estava marcado como
 * "provisório" no próprio ficheiro desde setembro e que se tornou a dívida
 * **D59** por ter sobrevivido a duas fases.
 *
 * Esta página é só a camada que **vai buscar**: o modo do site e o catálogo de
 * planos. O que desenha é `HomeSections`, que recebe tudo por prop — é o que
 * permite ver a home nos dois modos no canvas, onde nem a base de dados nem o
 * `next/headers` existem.
 *
 * **Não é `force-dynamic`.** As duas leituras passam por `unstable_cache` com
 * tag própria, para a home ser servida de cache e continuar a mudar quando o
 * Admin troca o modo ou edita um plano. Uma home pública renderizada por
 * pedido é a primeira coisa que o Lighthouse de 04 §2.1 AC penaliza.
 */
export default async function HomePage() {
  const [locale, launchMode, plans] = await Promise.all([
    getLocale(),
    getLaunchMode(),
    getPublicPlans(),
  ]);

  return (
    <HomeSections
      launchMode={launchMode}
      plans={plans}
      locale={locale}
      onLocaleChange={setLocalePreference}
    />
  );
}
