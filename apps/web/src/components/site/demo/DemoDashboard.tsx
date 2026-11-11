"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Bookmark,
  Building2,
  CalendarCheck,
  CalendarDays,
  Eye,
  FileSignature,
  MessageSquare,
  Store,
  Users,
} from "lucide-react";
import { Card, StatusTag, Tabs } from "@upm/ui";
import {
  DEMO_BUYER_ACTIVITY_CONTRACTS,
  DEMO_BUYER_ACTIVITY_MESSAGES,
  DEMO_BUYER_STATS,
  DEMO_BUYER_VIEWS,
  DEMO_OWNER_ACTIVITY_CONTRACTS,
  DEMO_OWNER_ACTIVITY_MESSAGES,
  DEMO_OWNER_STATS,
  DEMO_OWNER_VISITS,
  DEMO_OWNER_VIEWS,
  type DemoActivity,
  type DemoSectionId,
  type DemoSeries,
  type DemoStat,
  type DemoStatIcon,
} from "@upm/ui/demo-data";

import { useDemoFormat, type DemoRole } from "./format";

/**
 * Painel da demonstração — o mesmo desenho de 04 §8.3 e §2.4
 * =========================================================================
 * Os blocos são os do produto e pela mesma ordem: "As suas estatísticas" →
 * "Acesso rápido" → "Gráficos" → "Atividade recente". O do comprador não tem
 * "Próximas visitas" ao lado do gráfico — isso é do proprietário (04 §8.3) —,
 * por isso lá o gráfico ocupa a largura toda, como em `BuyerDashboard`.
 *
 * **Recriado e não importado.** `OwnerDashboard` e `BuyerDashboard` são
 * só-props e dariam exatamente isto, mas vivem em `apps/app` e esta demo vive
 * em `apps/web`: uma app não importa da outra. O que se partilha são os
 * componentes de `@upm/ui` e as fixtures de `@upm/ui/demo-data`.
 *
 * Os quatro atalhos do "Acesso rápido" **trocam de ecrã**, como no produto
 * trocam de rota: é a segunda porta para a navegação da demonstração, além do
 * menu.
 */

const STAT_ICONS: Record<DemoStatIcon, typeof Building2> = {
  building: Building2,
  eye: Eye,
  leads: Users,
  visits: CalendarCheck,
  saved: Bookmark,
  messages: MessageSquare,
  contracts: FileSignature,
};

const HINT_TONE = {
  ok: "var(--ok)",
  warn: "var(--warn)",
  muted: "var(--muted)",
} as const;

/**
 * Os quatro atalhos de cada perfil — 04 §8.3 e 04 §2.4.
 *
 * `bodyKey` é um caminho completo porque dois deles não existem no produto: o
 * "Acesso rápido" do proprietário aponta para Market, As minhas propriedades,
 * *Publicar novo imóvel* e Mapa, e publicar um imóvel é um formulário de
 * vários passos que a demonstração não mostra. No lugar dele vão as duas
 * secções que o proprietário abre todos os dias — Leads e Agenda —, com uma
 * frase própria em `site.demo.shortcut`.
 */
const SHORTCUTS: Record<DemoRole, { to: DemoSectionId; icon: typeof Store; bodyKey: string }[]> = {
  owner: [
    { to: "market", icon: Store, bodyKey: "dashboard.quickAccess.market.body" },
    { to: "myProperties", icon: Building2, bodyKey: "dashboard.quickAccess.myProperties.body" },
    { to: "leads", icon: Users, bodyKey: "site.demo.shortcut.leads" },
    { to: "visitSchedule", icon: CalendarDays, bodyKey: "site.demo.shortcut.visitSchedule" },
  ],
  buyer: [
    { to: "market", icon: Store, bodyKey: "dashboard.quickAccess.market.body" },
    { to: "saved", icon: Bookmark, bodyKey: "dashboard.quickAccess.saved.body" },
    { to: "myRequests", icon: CalendarDays, bodyKey: "dashboard.quickAccess.visitRequests.body" },
    { to: "messages", icon: MessageSquare, bodyKey: "dashboard.quickAccess.messages.body" },
  ],
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        margin: 0,
        fontSize: "var(--fs-subtitle)",
        fontWeight: "var(--fw-bold)",
        color: "var(--text)",
      }}
    >
      {children}
    </h2>
  );
}

function Stats({ stats }: { stats: DemoStat[] }) {
  const t = useTranslations("dashboard");
  const format = useDemoFormat();

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionTitle>{t("statsTitle")}</SectionTitle>
      <div
        style={{
          display: "grid",
          // A mesma regra do `DashboardStats` da app: 2 × 2 no telemóvel.
          gridTemplateColumns:
            "repeat(auto-fit, minmax(max(calc((100% - 42px) / 4), min(calc((100% - 14px) / 2), 190px)), 1fr))",
          gap: 14,
        }}
      >
        {stats.map((stat) => {
          const Icon = STAT_ICONS[stat.icon];
          return (
            <Card key={stat.id} padded>
              {/* `upm-stat` / `upm-stat__label` (components.css): num cartão
                  estreito o ícone sobe para cima do rótulo. */}
              <div
                className="upm-stat"
                style={{ display: "flex", flexDirection: "column", gap: 9 }}
              >
                <span
                  className="upm-stat__label"
                  style={{
                    fontSize: "var(--fs-label)",
                    fontWeight: "var(--fw-semibold)",
                    color: "var(--muted)",
                  }}
                >
                  <Icon size={15} color="var(--accent)" aria-hidden="true" />
                  {t(stat.labelKey)}
                </span>
                <strong
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "var(--fs-title-sm)",
                    fontWeight: "var(--fw-bold)",
                    color: "var(--text)",
                  }}
                >
                  {format.number(stat.value)}
                </strong>
                <span style={{ fontSize: "var(--fs-label)", color: HINT_TONE[stat.hintTone] }}>
                  {t(stat.hintKey, stat.hintParams)}
                </span>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function QuickAccess({
  role,
  onNavigate,
}: {
  role: DemoRole;
  onNavigate: (id: DemoSectionId) => void;
}) {
  const t = useTranslations();
  const tNav = useTranslations("nav");

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionTitle>{t("dashboard.quickAccess.title")}</SectionTitle>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 210px), 1fr))",
          gap: 14,
        }}
      >
        {SHORTCUTS[role].map((shortcut) => {
          const Icon = shortcut.icon;
          return (
            <button
              key={shortcut.to}
              type="button"
              onClick={() => onNavigate(shortcut.to)}
              className="upm-card upm-card--pad upm-card--interactive"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 11,
                textAlign: "left",
                cursor: "pointer",
                font: "inherit",
                color: "inherit",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "var(--r-lg)",
                    background: "var(--accent-soft)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: "none",
                  }}
                >
                  <Icon size={17} color="var(--accent)" aria-hidden="true" />
                </span>
                <strong style={{ fontSize: "var(--fs-body)", color: "var(--text)" }}>
                  {tNav(shortcut.to)}
                </strong>
              </span>
              <span
                style={{
                  fontSize: "var(--fs-label)",
                  color: "var(--muted)",
                  lineHeight: "var(--lh-normal)",
                }}
              >
                {t(shortcut.bodyKey)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

const PLOT_HEIGHT = 150;
const MIN_BAR = 16;

function ViewsChart({ series, title }: { series: DemoSeries[]; title: string }) {
  const t = useTranslations("dashboard");
  const format = useDemoFormat();
  const [rangeId, setRangeId] = useState(series[0]!.id);
  const active = series.find((item) => item.id === rangeId) ?? series[0]!;

  /**
   * As barras são os últimos dias (ou semanas) a contar de hoje — daí as
   * etiquetas nascerem aqui, de `Intl`, e não vierem das fixtures: um "Seg"
   * escrito à mão era texto, e texto traduz-se.
   */
  const buckets = active.values.map((value, index) => {
    const fromEnd = active.values.length - 1 - index;
    const date = active.granularity === "day" ? format.at(-fromEnd) : format.at(-fromEnd * 7);
    return {
      value,
      label: active.granularity === "day" ? format.weekday(date) : format.dayMonth(date),
      srLabel: format.date(date),
    };
  });
  const max = buckets.reduce((acc, bucket) => Math.max(acc, bucket.value), 1);

  return (
    <Card padded>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h3 className="upm-card__title" style={{ margin: 0 }}>
            {title}
          </h3>
          <div style={{ marginLeft: "auto" }}>
            <Tabs
              label={t("chartRange")}
              items={series.map((item) => ({ id: item.id, label: t(`chart.${item.id}`) }))}
              value={active.id}
              onValueChange={(id) => setRangeId(id as DemoSeries["id"])}
            />
          </div>
        </div>

        <div
          aria-hidden="true"
          style={{ display: "flex", alignItems: "flex-end", gap: 10, height: PLOT_HEIGHT }}
        >
          {buckets.map((bucket, index) => {
            const last = index === buckets.length - 1;
            return (
              <div
                key={bucket.srLabel}
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 7,
                  height: "100%",
                  justifyContent: "flex-end",
                }}
              >
                <span
                  style={{
                    fontSize: "var(--fs-label)",
                    fontWeight: "var(--fw-bold)",
                    color: last ? "var(--accent)" : "var(--muted)",
                  }}
                >
                  {format.number(bucket.value)}
                </span>
                <div
                  style={{
                    width: "100%",
                    maxWidth: 40,
                    height: Math.round(MIN_BAR + (bucket.value / max) * (PLOT_HEIGHT - 62)),
                    borderRadius: "8px 8px 4px 4px",
                    background: last ? "var(--accent)" : "var(--surface3)",
                  }}
                />
                <span style={{ fontSize: "var(--fs-label)", color: "var(--muted)" }}>
                  {bucket.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* A alternativa não visual do gráfico real (04 §5.7). */}
        <table className="upm-sr-only">
          <caption>{title}</caption>
          <tbody>
            {buckets.map((bucket) => (
              <tr key={bucket.srLabel}>
                <th scope="row">{bucket.srLabel}</th>
                <td>{format.number(bucket.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function UpcomingVisits({ onNavigate }: { onNavigate: (id: DemoSectionId) => void }) {
  const t = useTranslations("visits.upcoming");
  const tVisits = useTranslations("visits.status");
  const format = useDemoFormat();
  const rows = DEMO_OWNER_VISITS.filter((visit) => visit.dayOffset >= 0).slice(0, 3);

  return (
    <Card padded style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)" }}>
        <CalendarDays size={16} aria-hidden="true" color="var(--accent)" />
        <strong style={{ fontSize: "var(--fs-body-lg)" }}>{t("title")}</strong>
        <button
          type="button"
          onClick={() => onNavigate("visitSchedule")}
          style={{
            marginLeft: "auto",
            border: "none",
            background: "none",
            padding: 0,
            font: "inherit",
            fontWeight: "var(--fw-bold)",
            color: "var(--accent)",
            cursor: "pointer",
          }}
        >
          {t("seeSchedule")}
        </button>
      </div>

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "var(--sp-4)" }}>
        {rows.map((visit) => {
          const when = format.at(visit.dayOffset, visit.minuteOfDay);
          const box = format.dayBox(when);
          return (
            <li
              key={visit.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--sp-5)",
                padding: "var(--sp-5)",
                borderRadius: "var(--r-xl)",
                border: "1px solid var(--border)",
                background: "var(--surface2)",
                minWidth: 0,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 48,
                  flex: "none",
                  padding: "var(--sp-2) 0",
                  borderRadius: "var(--r-md)",
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                }}
              >
                <strong style={{ fontSize: "var(--fs-subtitle)", lineHeight: 1 }}>{box.day}</strong>
                <span
                  style={{
                    fontSize: "var(--fs-label)",
                    fontWeight: "var(--fw-black)",
                    textTransform: "uppercase",
                  }}
                >
                  {box.month}
                </span>
              </span>
              <span style={{ display: "grid", gap: "var(--sp-1)", minWidth: 0, flex: 1 }}>
                <strong
                  style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {visit.property}
                </strong>
                <span
                  style={{
                    color: "var(--muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {visit.other} · {tVisits(visit.status)}
                </span>
              </span>
              <span style={{ fontWeight: "var(--fw-black)", color: "var(--accent)", flex: "none" }}>
                {format.time(when)}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function ActivityPanel({
  icon,
  title,
  meta,
  items,
  onOpen,
}: {
  icon: React.ReactNode;
  title: string;
  meta: string;
  items: DemoActivity[];
  onOpen: () => void;
}) {
  const t = useTranslations();
  const format = useDemoFormat();
  const tActivity = useTranslations("contracts.activity");

  return (
    <Card style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-4)",
          padding: "var(--sp-6) var(--sp-7)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {icon}
        <strong style={{ fontSize: "var(--fs-body-lg)" }}>{title}</strong>
        <span style={{ marginLeft: "auto", color: "var(--muted)", whiteSpace: "nowrap" }}>
          {meta}
        </span>
      </div>

      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((item) => (
          <li key={item.id} style={{ borderBottom: "1px solid var(--border)" }}>
            <button
              type="button"
              onClick={onOpen}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "var(--sp-5)",
                padding: "var(--sp-5) var(--sp-7)",
                border: "none",
                background: "none",
                font: "inherit",
                textAlign: "left",
                color: "var(--text)",
                cursor: "pointer",
                minWidth: 0,
              }}
            >
              <span style={{ display: "grid", gap: "var(--sp-1)", minWidth: 0, flex: 1 }}>
                <strong
                  style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {item.title}
                </strong>
                <span
                  style={{
                    color: "var(--muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {tActivity("withCounterparty", {
                    name: item.person,
                    when: format.ago(item.minutesAgo),
                  })}
                </span>
              </span>
              <StatusTag tone={item.tone}>{t(item.tagKey)}</StatusTag>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function DemoDashboard({
  role,
  onNavigate,
}: {
  role: DemoRole;
  onNavigate: (id: DemoSectionId) => void;
}) {
  const t = useTranslations("dashboard");
  const tNav = useTranslations("nav");
  const owner = role === "owner";

  const messages = owner ? DEMO_OWNER_ACTIVITY_MESSAGES : DEMO_BUYER_ACTIVITY_MESSAGES;
  const contracts = owner ? DEMO_OWNER_ACTIVITY_CONTRACTS : DEMO_BUYER_ACTIVITY_CONTRACTS;
  const unanswered = messages.filter((item) => item.tone === "new").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-8)" }}>
      <Stats stats={owner ? DEMO_OWNER_STATS : DEMO_BUYER_STATS} />
      <QuickAccess role={role} onNavigate={onNavigate} />

      <section style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
        <SectionTitle>{t("charts")}</SectionTitle>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: owner
              ? "repeat(auto-fit, minmax(min(100%, 320px), 1fr))"
              : "minmax(0, 1fr)",
            gap: "var(--sp-7)",
            alignItems: "stretch",
          }}
        >
          <ViewsChart
            series={owner ? DEMO_OWNER_VIEWS : DEMO_BUYER_VIEWS}
            title={owner ? t("viewsTitle") : t("viewedTitle")}
          />
          {owner ? <UpcomingVisits onNavigate={onNavigate} /> : null}
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
        <SectionTitle>{t("recentActivity")}</SectionTitle>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
            gap: "var(--sp-7)",
          }}
        >
          <ActivityPanel
            icon={<MessageSquare size={16} aria-hidden="true" color="var(--accent)" />}
            title={t("recentMessages")}
            meta={
              unanswered === 0
                ? t("activity.allAnswered")
                : t("activity.unanswered", { count: unanswered })
            }
            items={messages}
            onOpen={() => onNavigate("messages")}
          />
          <ActivityPanel
            icon={<FileSignature size={16} aria-hidden="true" color="var(--accent)" />}
            title={tNav("contracts")}
            meta={t("activity.recentContracts", { count: contracts.length })}
            items={contracts}
            onOpen={() => onNavigate("contracts")}
          />
        </div>
      </section>
    </div>
  );
}
