"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { Tabs } from "@upm/ui";

import { PRICING } from "../../lib/site-content";
import { SectionHeading } from "./SiteSection";

/**
 * Preços (P2-03 · 04 §2.1)
 * =========================================================================
 * **Nenhum preço está escrito aqui.** Os planos chegam de `plans`, lidos no
 * servidor com `visible = true` — é a regra de 07 §20.8 ("nenhum preço fica
 * escrito em código") e é também o que resolve a contradição do protótipo: o
 * degrau Gratuito, que ele mostrava, está `visible = false` desde
 * `20261007120500_end_free_plan.sql` e por isso não aparece sem que este
 * componente precise de o saber.
 *
 * Duas tabs, como o protótipo: público (proprietários / compradores) e
 * periodicidade (anual / mensal). O mensal é a derivada do anual (07 §8.3), e
 * ambos vêm da base de dados — aqui só se escolhe qual mostrar.
 */

export type PublicPlan = {
  slug: string;
  name: string;
  audience: "owner" | "buyer" | "both";
  priceYearCents: number;
  priceMonthCents: number;
  features: string[];
  /** Destaca uma coluna. O catálogo decide, pela posição. */
  highlighted: boolean;
};

type Billing = "year" | "month";
type Audience = "owner" | "buyer";

function money(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale === "en" ? "en-IE" : "pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function Pricing({
  plans,
  locale,
  ctaHref,
  ctaLabel,
}: {
  plans: PublicPlan[];
  locale: string;
  /** União fechada e não `string`: os `typedRoutes` do Next recusam um
   *  destino que o router não conheça, e é por isso que esta prop não é
   *  livre — um CTA de preços para uma rota inexistente é um 404 no passo
   *  mais caro do funil. */
  ctaHref: "/pre-inscricao" | "/criar-conta";
  ctaLabel: string;
}) {
  const [audience, setAudience] = useState<Audience>("owner");
  const [billing, setBilling] = useState<Billing>("year");

  // `both` entra nas duas escadas: um plano para ambos os públicos é
  // relevante em qualquer das tabs.
  const visible = plans.filter((plan) => plan.audience === audience || plan.audience === "both");

  return (
    <div style={{ display: "grid", gap: "var(--sp-6)" }}>
      <SectionHeading
        eyebrow={PRICING.eyebrow}
        title={PRICING.title}
        body={PRICING.body}
        align="center"
      />

      <div
        style={{
          display: "flex",
          gap: "var(--sp-4)",
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <Tabs
          label={PRICING.eyebrow}
          value={audience}
          onValueChange={(id) => setAudience(id as Audience)}
          items={PRICING.audienceTabs.map((tab) => ({ id: tab.id, label: tab.label }))}
        />
        <Tabs
          label="Periodicidade"
          value={billing}
          onValueChange={(id) => setBilling(id as Billing)}
          items={PRICING.billingTabs.map((tab) => ({ id: tab.id, label: tab.label }))}
        />
      </div>

      {visible.length === 0 ? (
        // Catálogo vazio não é um ecrã partido: é uma frase honesta. Pode
        // acontecer em staging, e um painel de preços em branco faria o
        // visitante pensar que o site rebentou.
        <p style={{ textAlign: "center", color: "var(--muted)", fontSize: "14px" }}>
          Os planos para este público estão a ser preparados.
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(17rem, 100%), 1fr))",
            gap: "var(--sp-4)",
            alignItems: "start",
          }}
        >
          {visible.map((plan) => {
            const cents = billing === "year" ? plan.priceYearCents : plan.priceMonthCents;
            return (
              <li
                key={plan.slug}
                style={{
                  display: "grid",
                  gap: "var(--sp-4)",
                  padding: "var(--sp-5)",
                  borderRadius: "var(--r-lg)",
                  border: `1px solid ${plan.highlighted ? "var(--accent)" : "var(--border)"}`,
                  background: "var(--surface)",
                  alignContent: "start",
                }}
              >
                <div style={{ display: "grid", gap: "var(--sp-2)" }}>
                  <strong style={{ fontSize: "16px", color: "var(--text)" }}>{plan.name}</strong>
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "clamp(1.5rem, 3vw, 2rem)",
                      color: "var(--text)",
                      lineHeight: 1.1,
                    }}
                  >
                    {money(cents, locale)}
                    <span style={{ fontSize: "13px", color: "var(--muted)", fontWeight: 400 }}>
                      {billing === "year" ? " / ano" : " / mês"}
                    </span>
                  </span>
                </div>

                <ul
                  style={{
                    listStyle: "none",
                    margin: 0,
                    padding: 0,
                    display: "grid",
                    gap: "var(--sp-2)",
                  }}
                >
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      style={{
                        display: "flex",
                        gap: "var(--sp-2)",
                        alignItems: "start",
                        fontSize: "13.5px",
                        color: "var(--text)",
                      }}
                    >
                      <Check
                        size={15}
                        style={{ color: "var(--ok)", flexShrink: 0, marginTop: 2 }}
                      />
                      {feature}
                    </li>
                  ))}
                  {plan.features.length === 0 ? (
                    <li
                      style={{
                        display: "flex",
                        gap: "var(--sp-2)",
                        alignItems: "center",
                        fontSize: "13.5px",
                        color: "var(--muted)",
                      }}
                    >
                      <Minus size={15} style={{ flexShrink: 0 }} />
                      Funcionalidades por anunciar
                    </li>
                  ) : null}
                </ul>

                <Link
                  href={{ pathname: ctaHref, query: { plano: plan.slug } }}
                  className={`upm-btn upm-btn--${plan.highlighted ? "primary" : "secondary"} upm-btn--md upm-btn--full`}
                >
                  {ctaLabel}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
