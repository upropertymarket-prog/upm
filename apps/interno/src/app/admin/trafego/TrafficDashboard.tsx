"use client";

import { useTranslations } from "next-intl";
import { Card, EmptyState, PageHeader, Tabs } from "@upm/ui";
import { TrendingUp } from "lucide-react";

export type TrafficScope = "all" | "pre" | "post";
export type TrafficRange = 7 | 30 | 90;

export type TrafficSummary = {
  visits: number;
  uniques: number;
  conversions: number;
  conversionRate: number;
  avgDurationS: number;
  bounceRate: number;
};

export type TrafficPoint = { date: string; visits: number; conversions: number };

export type TrafficBreakdown = {
  path: { label: string; visits: number }[];
  source: { label: string; visits: number }[];
  device: { label: string; visits: number }[];
  city: { label: string; visits: number }[];
};

/** Milhares com espaço, como 04 §8.5 pede ("9 420"). */
function useFormatters(locale: string) {
  const number = new Intl.NumberFormat(locale === "en" ? "en-GB" : "pt-PT");
  const percent = new Intl.NumberFormat(locale === "en" ? "en-GB" : "pt-PT", {
    style: "percent",
    maximumFractionDigits: 1,
  });
  return { number, percent };
}

export type TrafficFilterChange = { scope?: TrafficScope; range?: TrafficRange };

/**
 * Tráfego do site — `/admin/trafego` (P8-06 · 04 §8.5)
 * =========================================================================
 * Os filtros não guardam estado aqui: avisam quem mostra o ecrã, que reescreve a
 * query string e deixa a página voltar a ler da base de dados. A agregação é
 * toda em SQL (08 §4.5), por isso guardar os dados no cliente para filtrar no
 * browser seria trazer o intervalo inteiro para a memória para mostrar uma fatia.
 *
 * `onFilterChange` é prop e não `useRouter()` por dentro de propósito: assim este
 * componente não importa nada de `next/navigation` e **renderiza no canvas**, que
 * corre num sidecar Vite sem router do Next. A ligação ao router vive em
 * `TrafficView`, que é o que a página usa.
 */
export function TrafficDashboard({
  locale,
  scope,
  range,
  summary,
  series,
  breakdown,
  onFilterChange,
}: {
  locale: string;
  scope: TrafficScope;
  range: TrafficRange;
  summary: TrafficSummary;
  series: TrafficPoint[];
  breakdown: TrafficBreakdown;
  onFilterChange: (next: TrafficFilterChange) => void;
}) {
  const t = useTranslations("admin.traffic");
  const { number, percent } = useFormatters(locale);

  const hasData = summary.visits > 0 || summary.conversions > 0;

  return (
    <div style={{ display: "grid", gap: "var(--sp-6)" }}>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <Card padded>
        <div
          style={{
            display: "grid",
            gap: "var(--sp-6)",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
          }}
        >
          <div style={{ display: "grid", gap: "var(--sp-2)", rowGap: "var(--sp-5)", minWidth: 0 }}>
            <span className="upm-field__label" aria-hidden="true">
              {t("scope.label")}
            </span>
            <Tabs
              label={t("scope.label")}
              value={scope}
              onValueChange={(value) => onFilterChange({ scope: value as TrafficScope })}
              items={[
                { id: "all", label: t("scope.all") },
                { id: "pre", label: t("scope.pre") },
                { id: "post", label: t("scope.post") },
              ]}
            />
          </div>
          <div style={{ display: "grid", gap: "var(--sp-2)", minWidth: 0 }}>
            <span className="upm-field__label" aria-hidden="true">
              {t("range.label")}
            </span>
            <Tabs
              label={t("range.label")}
              value={String(range)}
              onValueChange={(value) => onFilterChange({ range: Number(value) as TrafficRange })}
              items={[
                { id: "7", label: t("range.d7") },
                { id: "30", label: t("range.d30") },
                { id: "90", label: t("range.d90") },
              ]}
            />
          </div>
        </div>
      </Card>

      {!hasData ? (
        <Card padded>
          <EmptyState
            icon={<TrendingUp size={40} />}
            title={t("empty.title")}
            description={t("empty.body")}
          />
        </Card>
      ) : (
        <>
          {/* KPIs 3×2 (04 §8.5). O terceiro muda de nome com o âmbito: antes do
              lançamento conta pré-inscrições, depois contas criadas. */}
          <div
            style={{
              display: "grid",
              gap: "var(--sp-4)",
              // 3×2 à largura do Admin, como 04 §8.5 pede. O `min(100%, 320px)`
              // é o que o garante: com a coluna de conteúdo a ~1144 px cabem
              // três de 320 e não quatro — e em ecrã estreito cai para duas e
              // depois uma, sem media query.
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
            }}
          >
            <Kpi label={t("kpi.visits")} value={number.format(summary.visits)} />
            <Kpi label={t("kpi.uniques")} value={number.format(summary.uniques)} />
            <Kpi
              label={scope === "post" ? t("kpi.accounts") : t("kpi.signups")}
              value={number.format(summary.conversions)}
            />
            <Kpi label={t("kpi.conversion")} value={percent.format(summary.conversionRate)} />
            <Kpi
              label={t("kpi.duration")}
              value={t("seconds", { value: number.format(Math.round(summary.avgDurationS)) })}
            />
            <Kpi label={t("kpi.bounce")} value={percent.format(summary.bounceRate)} />
          </div>

          <TrafficChart series={series} locale={locale} />

          {/* Quatro cartões em 2×2 e de altura igual (04 §8.5). A altura igual
              vem do `grid`, que estica as células da mesma linha; o 2×2 vem do
              `min(100%, 420px)`, que à largura do Admin deixa caber duas colunas
              e não três. */}
          <section
            aria-labelledby="traffic-breakdown-title"
            style={{ display: "grid", gap: "var(--sp-4)" }}
          >
            <div style={{ display: "grid", gap: "var(--sp-2)" }}>
              <h2 id="traffic-breakdown-title" className="upm-card__title">
                {t("breakdown.title")}
              </h2>
              <p style={{ margin: 0, fontSize: "var(--fs-body)", color: "var(--muted)" }}>
                {t("breakdown.subtitle")}
              </p>
            </div>
            <div
              style={{
                display: "grid",
                gap: "var(--sp-4)",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
              }}
            >
              <BreakdownCard title={t("cards.path")} rows={breakdown.path} locale={locale} />
              <BreakdownCard title={t("cards.source")} rows={breakdown.source} locale={locale} />
              <BreakdownCard title={t("cards.device")} rows={breakdown.device} locale={locale} />
              <BreakdownCard title={t("cards.city")} rows={breakdown.city} locale={locale} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card padded style={{ display: "grid", gap: "var(--sp-3)", alignContent: "start" }}>
      <span className="upm-field__label">{label}</span>
      <strong
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--fs-title)",
          fontVariantNumeric: "tabular-nums",
          lineHeight: "var(--lh-tight)",
        }}
      >
        {value}
      </strong>
    </Card>
  );
}

const PLOT_HEIGHT = 180;

/**
 * Visitas e conversões, **numa escala só**.
 *
 * Duas escalas y seriam o erro clássico: as visitas andam nos milhares e as
 * conversões nas dezenas, e um segundo eixo deixa o leitor comparar alturas que
 * não são comparáveis. Aqui não é preciso, porque **as conversões são um
 * subconjunto das visitas**: desenham-se na base da mesma barra, e a barra
 * inteira continua a ser as visitas do dia. Lê-se "destas visitas, estas
 * converteram", que é a pergunta.
 *
 * As cores seguem o `ViewsChart` da Fase 4, que é a linguagem de gráfico deste
 * produto: `--accent` para o que importa, `--surface3` para o contexto. O par foi
 * passado pelo validador de contraste — separação para daltonismo ΔE 32 (claro) e
 * 40 (escuro), bem acima do mínimo. O aviso de contraste do tom recessivo obriga
 * a rótulos visíveis ou tabela alternativa, e há os dois.
 */
function TrafficChart({ series, locale }: { series: TrafficPoint[]; locale: string }) {
  const t = useTranslations("admin.traffic");
  const { number } = useFormatters(locale);
  const max = series.reduce((acc, point) => Math.max(acc, point.visits), 1);

  const dayLabel = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "pt-PT", {
    day: "2-digit",
    month: "2-digit",
  });

  // Com 90 dias, um rótulo por barra fica ilegível: mostra-se um em cada N.
  const labelEvery = Math.ceil(series.length / 12);

  return (
    <Card padded>
      <div style={{ display: "grid", gap: "var(--sp-4)" }}>
        <div
          style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)", flexWrap: "wrap" }}
        >
          <h3 className="upm-card__title" style={{ margin: 0 }}>
            {t("chart.title")}
          </h3>
          {/* Duas séries ⇒ legenda sempre presente: a identidade nunca fica só
              na cor. */}
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              gap: "var(--sp-4)",
              fontSize: "var(--fs-label)",
              color: "var(--muted)",
            }}
          >
            <LegendKey color="var(--surface3)" label={t("chart.visits")} />
            <LegendKey color="var(--accent)" label={t("chart.conversions")} />
          </div>
        </div>

        <div
          aria-hidden="true"
          style={{ display: "flex", alignItems: "flex-end", gap: 3, height: PLOT_HEIGHT }}
        >
          {series.map((point, index) => {
            const total = Math.max(1, Math.round((point.visits / max) * PLOT_HEIGHT));
            const converted = point.visits > 0 ? (point.conversions / point.visits) * total : 0;
            return (
              <div
                key={point.date}
                title={`${point.date} · ${number.format(point.visits)} / ${number.format(point.conversions)}`}
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  height: "100%",
                  justifyContent: "flex-end",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                    width: "100%",
                    maxWidth: 28,
                    height: total,
                    borderRadius: "6px 6px 4px 4px",
                    overflow: "hidden",
                    background: "var(--surface3)",
                  }}
                >
                  {/* 2 px de folga da superfície entre as duas áreas, para a
                      fronteira ser visível mesmo com pouca conversão. */}
                  <span
                    style={{
                      height: Math.max(converted > 0 ? 3 : 0, Math.round(converted)),
                      background: "var(--accent)",
                      borderTop: converted > 0 ? "2px solid var(--surface)" : "none",
                      borderRadius: "4px 4px 4px 4px",
                    }}
                  />
                </span>
                <span
                  style={{
                    fontSize: "var(--fs-label)",
                    color: "var(--muted)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {index % labelEvery === 0
                    ? dayLabel.format(new Date(`${point.date}T00:00:00Z`))
                    : ""}
                </span>
              </div>
            );
          })}
        </div>

        <p style={{ margin: 0, fontSize: "var(--fs-label)", color: "var(--muted)" }}>
          {t("chart.note")}
        </p>

        {/* Alternativa não visual, como no ViewsChart da Fase 4. */}
        <table className="upm-sr-only">
          <caption>{t("chart.tableCaption")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("chart.title")}</th>
              <th scope="col">{t("chart.visits")}</th>
              <th scope="col">{t("chart.conversions")}</th>
            </tr>
          </thead>
          <tbody>
            {series.map((point) => (
              <tr key={point.date}>
                <th scope="row">{point.date}</th>
                <td>{number.format(point.visits)}</td>
                <td>{number.format(point.conversions)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        aria-hidden="true"
        style={{ width: 10, height: 10, borderRadius: 3, background: color }}
      />
      {label}
    </span>
  );
}

function BreakdownCard({
  title,
  rows,
  locale,
}: {
  title: string;
  rows: { label: string; visits: number }[];
  locale: string;
}) {
  const t = useTranslations("admin.traffic");
  const { number } = useFormatters(locale);
  const max = rows.reduce((acc, row) => Math.max(acc, row.visits), 1);

  return (
    <Card padded style={{ display: "grid", gap: "var(--sp-4)", alignContent: "start" }}>
      <h3 className="upm-card__title" style={{ margin: 0 }}>
        {title}
      </h3>

      {rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: "var(--fs-body)", color: "var(--muted)" }}>
          {t("emptyCard")}
        </p>
      ) : (
        <div style={{ display: "grid", gap: "var(--sp-3)" }}>
          {rows.map((row) => (
            <div key={row.label} style={{ display: "grid", gap: 4 }}>
              <div style={{ display: "flex", gap: "var(--sp-3)", fontSize: "var(--fs-body)" }}>
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.label}
                </span>
                <span
                  style={{
                    marginLeft: "auto",
                    color: "var(--muted)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {number.format(row.visits)}
                </span>
              </div>
              <span
                aria-hidden="true"
                style={{
                  height: 6,
                  borderRadius: "var(--r-pill)",
                  background: "var(--surface3)",
                  overflow: "hidden",
                }}
              >
                <span
                  style={{
                    display: "block",
                    height: "100%",
                    width: `${Math.round((row.visits / max) * 100)}%`,
                    background: "var(--accent)",
                    borderRadius: "var(--r-pill)",
                  }}
                />
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
