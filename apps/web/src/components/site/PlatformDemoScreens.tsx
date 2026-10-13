"use client";

import { AppShell, Card, CardBody, StatusTag, Table, type TableColumn } from "@upm/ui";
import {
  DEMO_BUYER_LISTINGS,
  DEMO_BUYER_NAV,
  DEMO_BUYER_NOTIFICATIONS,
  DEMO_BUYER_USER,
  DEMO_LOCALES,
  DEMO_OWNER_KPIS,
  DEMO_OWNER_LEADS,
  DEMO_OWNER_NAV,
  DEMO_OWNER_NOTIFICATIONS,
  DEMO_OWNER_USER,
  DEMO_SIDEBAR_LABELS,
  DEMO_TOPBAR_LABELS,
  type DemoLead,
} from "@upm/ui/demo-data";

import type { TabId } from "./PlatformDemo";

/**
 * Os ecrãs da demonstração, num módulo à parte (P2-04)
 * =========================================================================
 * **Separados do `PlatformDemo` por causa do peso, não por arrumação.** Isto
 * arrasta o `AppShell` inteiro — sidebar, topbar, menus — e as fixtures. Com
 * tudo num ficheiro só, esse código entrava no chunk da home e era descarregado
 * e interpretado por toda a gente que abre o site, incluindo quem nunca desce
 * até à secção da plataforma. A home é precisamente a página onde o AC de P2-06
 * mede Lighthouse ≥ 90.
 *
 * O `PlatformDemo` carrega este módulo com `next/dynamic` e `ssr: false`, e só
 * quando a secção se aproxima do ecrã. `ssr: false` porque não há nada aqui que
 * valha a pena ter no HTML servido: é uma demonstração com dados inventados,
 * não conteúdo que se queira indexado — e renderizá-la no servidor só engordava
 * o HTML da home.
 *
 * `noop` repete-se aqui em vez de ser importado do `PlatformDemo`: importá-lo
 * de lá criava uma dependência circular entre os dois módulos, que é o que
 * desfaz o code-splitting que isto existe para conseguir.
 */

/** Na demo nada acontece: os controlos desenham-se e não levam a lado nenhum. */
const noop = () => undefined;

const LEAD_TONES = {
  new: { tone: "new", label: "Nova" },
  answered: { tone: "active", label: "Respondida" },
  scheduled: { tone: "visitAccepted", label: "Visita marcada" },
} as const;

const LEAD_COLUMNS: TableColumn<DemoLead>[] = [
  { id: "name", header: "Interessado", cell: (lead) => lead.name },
  { id: "property", header: "Propriedade", cell: (lead) => lead.property },
  { id: "when", header: "Quando", cell: (lead) => lead.when },
  {
    id: "state",
    header: "Estado",
    cell: (lead) => (
      <StatusTag tone={LEAD_TONES[lead.state].tone}>{LEAD_TONES[lead.state].label}</StatusTag>
    ),
  },
];

function OwnerScreen() {
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h3 style={{ margin: 0, fontSize: 20 }}>Bom dia, Marta.</h3>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
          Tem 2 leads por responder e uma visita marcada para quinta-feira.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))",
          gap: 12,
        }}
      >
        {DEMO_OWNER_KPIS.map((kpi) => (
          <Card key={kpi.id}>
            <CardBody style={{ gap: 4, padding: 16 }}>
              <span style={{ color: "var(--muted)", fontSize: 12 }}>{kpi.label}</span>
              <strong style={{ fontSize: 24, lineHeight: 1.1 }}>{kpi.value}</strong>
              <span style={{ color: "var(--muted)", fontSize: 12 }}>{kpi.hint}</span>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardBody style={{ gap: 12, padding: 16 }}>
          <strong style={{ fontSize: 15 }}>Últimas leads</strong>
          <Table
            caption="Últimas leads recebidas"
            columns={LEAD_COLUMNS}
            rows={DEMO_OWNER_LEADS}
            rowKey={(lead) => lead.id}
          />
        </CardBody>
      </Card>
    </div>
  );
}

function BuyerScreen() {
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h3 style={{ margin: 0, fontSize: 20 }}>Market</h3>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
          4 propriedades a corresponder à sua procura guardada.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
          gap: 12,
        }}
      >
        {DEMO_BUYER_LISTINGS.map((listing) => (
          <Card key={listing.id}>
            <div
              aria-hidden="true"
              style={{
                aspectRatio: "16 / 10",
                background: "var(--surface2)",
                borderTopLeftRadius: "inherit",
                borderTopRightRadius: "inherit",
                display: "grid",
                placeItems: "center",
                color: "var(--muted)",
                fontSize: 12,
              }}
            >
              fotografia
            </div>
            <CardBody style={{ gap: 8, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <StatusTag tone={listing.deal === "sale" ? "dealSale" : "dealRent"}>
                  {listing.deal === "sale" ? "Venda" : "Arrendamento"}
                </StatusTag>
                {listing.saved ? <StatusTag tone="primary">Guardado</StatusTag> : null}
              </div>
              <strong style={{ fontSize: 14, lineHeight: 1.3 }}>{listing.title}</strong>
              <span style={{ fontSize: 18, fontWeight: 700 }}>{listing.price}</span>
              <span style={{ color: "var(--muted)", fontSize: 12 }}>
                {listing.typology} · {listing.area} m² · {listing.city}
              </span>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}

function DemoShell({ active, children }: { active: TabId; children: React.ReactNode }) {
  const owner = active === "owner";
  return (
    <AppShell
      // `.upm-shell` traz `min-height: 100vh` e aqui vive numa caixa, não numa
      // janela. `100%` e **nunca** uma altura em pixels — o aviso no próprio
      // `AppShell` diz o que isso parte. A nota completa, com a segunda
      // armadilha (a sidebar `fixed`), está em `PlatformDemo.tsx`.
      style={{ minHeight: "100%" }}
      sidebar={{
        groups: owner ? DEMO_OWNER_NAV : DEMO_BUYER_NAV,
        activeId: owner ? "painel" : "market",
        user: owner ? DEMO_OWNER_USER : DEMO_BUYER_USER,
        onReport: noop,
        onSignOut: noop,
        labels: DEMO_SIDEBAR_LABELS,
      }}
      topbar={{
        labels: DEMO_TOPBAR_LABELS,
        locale: "pt",
        locales: DEMO_LOCALES,
        onLocaleChange: noop,
        notifications: owner ? DEMO_OWNER_NOTIFICATIONS : DEMO_BUYER_NOTIFICATIONS,
        onMarkAllRead: noop,
      }}
    >
      {children}
    </AppShell>
  );
}
/** O que o `PlatformDemo` monta: os dois painéis, ambos presentes. */
export default function PlatformDemoScreens({ active }: { active: TabId }) {
  return (
    <>
      {(["owner", "buyer"] as const).map((id) => (
        <div
          key={id}
          role="tabpanel"
          id={`demo-panel-${id}`}
          aria-labelledby={`demo-tab-${id}`}
          hidden={active !== id}
          style={{ height: "100%", overflow: "auto" }}
        >
          <DemoShell active={id}>{id === "owner" ? <OwnerScreen /> : <BuyerScreen />}</DemoShell>
        </div>
      ))}
    </>
  );
}
