"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Check, Minus } from "lucide-react";
import { Tabs } from "@upm/ui";

import { PRICING_AUDIENCE_IDS, PRICING_BILLING_IDS } from "../../lib/site-content";
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
  /**
   * Os limites do plano (`plans.limits`, 07 §19.2). Quando `features` vem
   * vazio, é daqui que sai a lista do cartão (6 nov 2026): até então o site
   * mostrava "Funcionalidades por anunciar" com os limites já decididos na base.
   * `null` num limite é "ilimitado".
   */
  limits: PlanLimits;
  /** Destaca uma coluna. O catálogo decide, pela posição. */
  highlighted: boolean;
};

export type PlanLimits = Partial<
  Record<
    "active_properties" | "visits" | "active_chats" | "saved" | "alerts" | "cloud_gb",
    number | null
  >
>;

type Billing = "year" | "month";
type Audience = (typeof PRICING_AUDIENCE_IDS)[number];

/**
 * O que cada público lê primeiro. Ao proprietário interessa quantas
 * propriedades publica; ao comprador, quantas guarda e quantos alertas tem.
 */
const LIMITS_BY_AUDIENCE: Record<"owner" | "buyer", ReadonlyArray<keyof PlanLimits>> = {
  owner: ["active_properties", "visits", "active_chats", "cloud_gb"],
  buyer: ["saved", "alerts", "visits", "active_chats", "cloud_gb"],
};

const LIMIT_KEYS: Record<keyof PlanLimits, { count: string; unlimited?: string }> = {
  active_properties: { count: "properties", unlimited: "propertiesUnlimited" },
  visits: { count: "visits", unlimited: "visitsUnlimited" },
  active_chats: { count: "chats", unlimited: "chatsUnlimited" },
  saved: { count: "saved", unlimited: "savedUnlimited" },
  alerts: { count: "alerts" },
  cloud_gb: { count: "cloud" },
};

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
  const t = useTranslations("site.pricing");
  const [audience, setAudience] = useState<Audience>("owner");
  const [billing, setBilling] = useState<Billing>("year");

  // `both` entra nas duas escadas: um plano para ambos os públicos é
  // relevante em qualquer das tabs.
  const visible =
    audience === "builder"
      ? []
      : plans.filter((plan) => plan.audience === audience || plan.audience === "both");

  function featureLines(plan: PublicPlan): string[] {
    if (plan.features.length > 0) return plan.features;
    if (audience === "builder") return [];
    return LIMITS_BY_AUDIENCE[audience].flatMap((key) => {
      if (!(key in plan.limits)) return [];
      const value = plan.limits[key];
      const keys = LIMIT_KEYS[key];
      if (value === null || value === undefined) {
        return keys.unlimited ? [t(`limits.${keys.unlimited}`)] : [];
      }
      // Zero não é uma funcionalidade: um plano sem cloud não diz "0 GB".
      if (value <= 0) return [];
      return [t(`limits.${keys.count}`, { count: value })];
    });
  }

  return (
    <div style={{ display: "grid", gap: "var(--sp-6)" }}>
      <SectionHeading eyebrow={t("eyebrow")} title={t("title")} body={t("body")} align="center" />

      <div
        style={{
          display: "flex",
          gap: "var(--sp-4)",
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <Tabs
          label={t("eyebrow")}
          value={audience}
          onValueChange={(id) => setAudience(id as Audience)}
          items={PRICING_AUDIENCE_IDS.map((id) => ({ id, label: t(`audienceTabs.${id}`) }))}
        />
        <Tabs
          label={t("billingLabel")}
          value={billing}
          onValueChange={(id) => setBilling(id as Billing)}
          items={PRICING_BILLING_IDS.map((id) => ({ id, label: t(`billingTabs.${id}`) }))}
        />
      </div>

      {visible.length === 0 ? (
        // Catálogo vazio não é um ecrã partido: é uma frase honesta. Pode
        // acontecer em staging, e um painel de preços em branco faria o
        // visitante pensar que o site rebentou. Para os construtores ainda
        // não há planos, e a frase leva ao contacto.
        <div style={{ display: "grid", gap: "var(--sp-4)", justifyItems: "center" }}>
          <p
            style={{
              margin: 0,
              maxWidth: "34rem",
              textAlign: "center",
              color: "var(--muted)",
              fontSize: "var(--fs-body)",
              lineHeight: 1.6,
            }}
          >
            {audience === "builder" ? t("builderSoon") : t("audienceSoon")}
          </p>
          {audience === "builder" ? (
            <a href="#contactos" className="upm-btn upm-btn--secondary upm-btn--md">
              {t("builderCta")}
            </a>
          ) : null}
        </div>
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
                    <span
                      style={{
                        fontSize: "var(--fs-body)",
                        color: "var(--muted)",
                        fontWeight: "var(--fw-regular)",
                      }}
                    >
                      {/* Pelo dicionário desde 7 nov 2026: escrito à mão, o site em inglês
                          dizia "/ ano". */}
                      {t(`per.${billing}`)}
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
                  {featureLines(plan).map((feature) => (
                    <li
                      key={feature}
                      style={{
                        display: "flex",
                        gap: "var(--sp-2)",
                        alignItems: "start",
                        fontSize: "var(--fs-body)",
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
                  {featureLines(plan).length === 0 ? (
                    <li
                      style={{
                        display: "flex",
                        gap: "var(--sp-2)",
                        alignItems: "center",
                        fontSize: "var(--fs-body)",
                        color: "var(--muted)",
                      }}
                    >
                      <Minus size={15} style={{ flexShrink: 0 }} />
                      {t("featuresSoon")}
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
