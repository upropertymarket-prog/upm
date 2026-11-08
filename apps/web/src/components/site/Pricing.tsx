"use client";

import { useState, type CSSProperties } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2, Minus, XCircle } from "lucide-react";
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
 *
 * **O cartão segue o desenho do cliente** (8 nov 2026): o nome num selo de
 * cor, o preço grande com o período colado, uma frase "Ideal para…", e duas
 * secções — Funcionalidades e Alertas — com ✓ verde para o que o plano inclui
 * e ✗ vermelho para o que não inclui. Tudo sai dos limites do plano; os tipos
 * de alerta do desenho (mensagens, descida de preço…) não estão decididos no
 * projeto e entram quando o forem.
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
 * propriedades publica; ao comprador, quantas guarda. Os alertas têm secção
 * própria.
 */
const LIMITS_BY_AUDIENCE: Record<"owner" | "buyer", ReadonlyArray<keyof PlanLimits>> = {
  owner: ["active_properties", "visits", "active_chats", "cloud_gb"],
  buyer: ["saved", "visits", "active_chats", "cloud_gb"],
};

const LIMIT_KEYS: Record<keyof PlanLimits, { count: string; unlimited?: string }> = {
  active_properties: { count: "properties", unlimited: "propertiesUnlimited" },
  visits: { count: "visits", unlimited: "visitsUnlimited" },
  active_chats: { count: "chats", unlimited: "chatsUnlimited" },
  saved: { count: "saved", unlimited: "savedUnlimited" },
  alerts: { count: "alerts" },
  cloud_gb: { count: "cloud" },
};

/**
 * A cor do selo de cada plano, pela posição na escada (do desenho do cliente):
 * laranja, azul, roxo. As variáveis estão em `site.css`.
 */
const SELOS = ["var(--plan-1)", "var(--plan-2)", "var(--plan-3)"] as const;

type Linha = { texto: string; incluida: boolean };

const ROTULO: CSSProperties = {
  margin: 0,
  fontSize: "var(--fs-label)",
  fontWeight: "var(--fw-semibold)",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--muted)",
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

  /** Um limite em linha: `null` é ilimitado, zero é "não incluído". */
  function linha(plan: PublicPlan, key: keyof PlanLimits): Linha[] {
    if (!(key in plan.limits)) return [];
    const value = plan.limits[key];
    const keys = LIMIT_KEYS[key];
    if (value === null || value === undefined) {
      return keys.unlimited ? [{ texto: t(`limits.${keys.unlimited}`), incluida: true }] : [];
    }
    // Zero não se escreve "0 GB": é a funcionalidade, marcada como não incluída.
    if (value <= 0) return [{ texto: t(`limitsMissing.${key}`), incluida: false }];
    return [{ texto: t(`limits.${keys.count}`, { count: value }), incluida: true }];
  }

  function featureLines(plan: PublicPlan): Linha[] {
    if (plan.features.length > 0) return plan.features.map((texto) => ({ texto, incluida: true }));
    if (audience === "builder") return [];
    return LIMITS_BY_AUDIENCE[audience].flatMap((key) => linha(plan, key));
  }

  /**
   * A frase por baixo do preço ("Ideal para…"), tirada dos limites: ao
   * proprietário diz quantas propriedades, ao comprador quantas acompanha.
   */
  function description(plan: PublicPlan): string | null {
    if (audience === "builder") return null;
    const key = audience === "owner" ? "active_properties" : "saved";
    if (!(key in plan.limits)) return null;
    const value = plan.limits[key];
    return value === null || value === undefined
      ? t(`ideal.${audience}Unlimited`)
      : t(`ideal.${audience}`, { count: value });
  }

  return (
    // Duas distâncias (8 nov 2026, pedido do cliente): 40 px do texto às
    // tabs, que antes estavam coladas ao parágrafo; 24 px das tabs aos cartões.
    <div style={{ display: "grid", gap: "var(--site-gap)" }}>
      <SectionHeading eyebrow={t("eyebrow")} title={t("title")} body={t("body")} align="center" />

      <div style={{ display: "grid", gap: "var(--sp-9)" }}>
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
          // A frase dos construtores maior e em medium, e o botão mais longe
          // dela (pedido do cliente, 8 nov 2026): é a única coisa que o
          // separador mostra, e em corpo pequeno parecia uma nota de rodapé.
          <div style={{ display: "grid", gap: "var(--sp-9)", justifyItems: "center" }}>
            <p
              style={{
                margin: 0,
                maxWidth: "38rem",
                textAlign: "center",
                color: "var(--text)",
                fontSize: "18px",
                fontWeight: "var(--fw-medium)",
                lineHeight: 1.55,
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
              gap: "var(--sp-8)",
              alignItems: "start",
            }}
          >
            {visible.map((plan, posicao) => {
              const cents = billing === "year" ? plan.priceYearCents : plan.priceMonthCents;
              const ideal = description(plan);
              const alertas = linha(plan, "alerts");
              return (
                <li
                  key={plan.slug}
                  style={{
                    display: "grid",
                    gap: "var(--sp-8)",
                    padding: "var(--sp-8)",
                    borderRadius: "var(--r-lg)",
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    alignContent: "start",
                  }}
                >
                  <div style={{ display: "grid", gap: "var(--sp-5)", justifyItems: "start" }}>
                    <span
                      style={{
                        padding: "6px 12px",
                        borderRadius: "var(--r-md)",
                        background: SELOS[posicao % SELOS.length],
                        // Branco fixo: os três fundos do selo são escuros nos
                        // dois temas.
                        color: "#fff",
                        fontSize: "var(--fs-body)",
                        fontWeight: "var(--fw-semibold)",
                      }}
                    >
                      {plan.name}
                    </span>
                    <div style={{ display: "grid", gap: "var(--sp-2)" }}>
                      <span
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: "clamp(1.6rem, 3vw, 2rem)",
                          fontWeight: "var(--fw-bold)",
                          color: "var(--text)",
                          lineHeight: 1.1,
                        }}
                      >
                        {money(cents, locale)}
                        <span style={{ fontSize: "0.7em", fontWeight: "var(--fw-semibold)" }}>
                          {/* Pelo dicionário desde 7 nov 2026: escrito à mão, o site
                              em inglês dizia "/ ano". */}
                          {t(`per.${billing}`)}
                        </span>
                      </span>
                      {ideal ? (
                        <p style={{ margin: 0, fontSize: "var(--fs-body)", color: "var(--muted)" }}>
                          {ideal}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <Secao
                    titulo={t("sections.features")}
                    linhas={featureLines(plan)}
                    vazio={t("featuresSoon")}
                  />

                  {alertas.length > 0 ? (
                    <>
                      <hr style={{ margin: 0, border: 0, borderTop: "1px solid var(--border)" }} />
                      <Secao titulo={t("sections.alerts")} linhas={alertas} />
                    </>
                  ) : null}

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
    </div>
  );
}

/** "FUNCIONALIDADES" / "ALERTAS" e a lista, com ✓ verde ou ✗ vermelho. */
function Secao({ titulo, linhas, vazio }: { titulo: string; linhas: Linha[]; vazio?: string }) {
  const item: CSSProperties = {
    display: "flex",
    gap: "var(--sp-4)",
    alignItems: "start",
    fontSize: "var(--fs-body)",
    color: "var(--text)",
  };
  return (
    <div style={{ display: "grid", gap: "var(--sp-5)" }}>
      <p style={ROTULO}>{titulo}</p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "var(--sp-5)" }}>
        {linhas.map(({ texto, incluida }) => (
          <li key={texto} style={item}>
            {incluida ? (
              <CheckCircle2
                size={17}
                aria-hidden="true"
                style={{ color: "var(--ok)", flexShrink: 0, marginTop: 1 }}
              />
            ) : (
              <XCircle
                size={17}
                aria-hidden="true"
                style={{ color: "var(--danger)", flexShrink: 0, marginTop: 1 }}
              />
            )}
            {texto}
          </li>
        ))}
        {linhas.length === 0 && vazio ? (
          <li style={{ ...item, alignItems: "center", color: "var(--muted)" }}>
            <Minus size={17} aria-hidden="true" style={{ flexShrink: 0 }} />
            {vazio}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
