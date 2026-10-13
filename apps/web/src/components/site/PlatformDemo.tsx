"use client";

import { useState } from "react";
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

/**
 * Demonstração interativa da plataforma — `/#plataforma` (P2-04 · 07 §7)
 * =========================================================================
 * O lugar desta secção estava reservado desde P2-01 com uma caixa 16/10 vazia e
 * um comentário a dizer "a demonstração interativa é P2-04 e ainda não existe".
 * É o que isto substitui.
 *
 * ## O que 07 §7 decidiu, e que este ficheiro cumpre
 *
 * **"A demo não toca na app autenticada."** O plano de implementação ainda
 * descreve P2-04 como "usa rotas `?demo=1` das apps"; 07 §7 revogou-o e é a
 * decisão que vale: *"a rota `?demo=1` em app.upropertymarket.pt é eliminada.
 * Era a única via de expor rotas autenticadas ao público, e não vale o risco."*
 * Daí os ecrãs montarem-se aqui, em `apps/web`, com os componentes reais de
 * `@upm/ui` e as fixtures de `@upm/ui/demo-data` — sem sessão, sem cliente
 * Supabase, sem um pedido de rede, sem RLS no caminho.
 *
 * **Os dois separadores ficam montados ao mesmo tempo.** 07 §7 pede-os
 * "pré-carregados para não haver ecrã branco na troca", e é por isso que o
 * separador inativo é escondido com `hidden` em vez de deixar de ser
 * renderizado: um `{activo === "x" ? <A/> : <B/>}` desmonta a árvore e a troca
 * passa a ter um instante em branco enquanto o shell volta a montar. O custo é
 * montar dois shells; o ganho é a troca ser instantânea, que é precisamente o
 * que a decisão pede.
 *
 * `hidden` (o atributo) e não `display: none` à mão: tira o conteúdo da árvore
 * de acessibilidade e da ordem de tabulação ao mesmo tempo, que é o que impede
 * o teclado de entrar num separador que não se está a ver.
 *
 * **O tema da demo é independente do tema do site.** Também de 07 §7. O
 * `data-theme="light"` fixo no envoltório faz com que os tokens resolvam
 * sempre em claro lá dentro, mesmo que o visitante esteja a ver o site em
 * escuro — o atributo mais próximo é o que manda. É deliberado: o que se está a
 * mostrar é o produto, não mais uma superfície do site, e o enquadramento
 * neutro à volta (`--surface2`) é o que 05 §1.1 chama "fundo neutro".
 *
 * ## As duas armadilhas de embeber o `AppShell`
 *
 * O shell foi escrito para ocupar uma janela, não uma caixa dentro de uma
 * página, e isso dá dois problemas que não são óbvios:
 *
 *  1. **`.upm-shell` tem `min-height: 100vh`** (`shell.css`). Dentro desta
 *     caixa isso daria um shell da altura do ecrã inteiro a transbordar de uma
 *     moldura de 560 px. Passa-se `minHeight: "100%"` por `style`, que é o uso
 *     que o próprio componente prevê ("o `style` existe para o consumidor
 *     ajustar o que precisar"). **Não se lhe dá uma altura em pixels** — o
 *     aviso no `AppShell` é explícito sobre o que isso parte: topbar comprimida
 *     e faixas vazias.
 *  2. **`.upm-sidebar` é `position: fixed`.** Sem contenção, a sidebar da demo
 *     colava-se ao viewport do browser e flutuava por cima da home inteira. O
 *     `transform: translateZ(0)` no envoltório resolve-o pela regra da CSS que
 *     diz que um elemento transformado passa a ser o bloco de contenção dos
 *     descendentes `fixed` — a sidebar passa a ser fixa *em relação à caixa da
 *     demo*, que é o que se quer.
 *
 * Nada disto precisou de tocar no `AppShell`: o shell que a demo mostra é, à
 * letra, o mesmo que o produto usa.
 */

const TABS = [
  { id: "owner", label: "Proprietário" },
  { id: "buyer", label: "Comprador" },
] as const;

type TabId = (typeof TABS)[number]["id"];

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

function DemoShell({
  active,
  children,
}: {
  active: TabId;
  children: React.ReactNode;
}) {
  const owner = active === "owner";
  return (
    <AppShell
      // Ver a nota do ficheiro: `100%` e nunca uma altura em pixels.
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

export function PlatformDemo() {
  const [active, setActive] = useState<TabId>("owner");

  return (
    <div style={{ display: "grid", gap: "var(--sp-5)" }}>
      <div
        role="tablist"
        aria-label="Perfis da demonstração"
        style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`demo-tab-${tab.id}`}
            aria-selected={active === tab.id}
            aria-controls={`demo-panel-${tab.id}`}
            onClick={() => setActive(tab.id)}
            className={`upm-btn upm-btn--${active === tab.id ? "primary" : "secondary"} upm-btn--md`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* O envoltório da demo. `data-theme` fixo e `data-app` da app (não
          "web"): lá dentro a tipografia tem de ser a da plataforma, não a do
          site público, que 07 §3 sobe para 14 px. `translateZ(0)` é o que
          prende a sidebar `fixed` a esta caixa — ver a nota do ficheiro. */}
      <div
        data-theme="light"
        style={{
          height: "clamp(420px, 56vw, 620px)",
          overflow: "hidden",
          borderRadius: "var(--r-lg)",
          border: "1px solid var(--border)",
          background: "var(--surface2)",
          transform: "translateZ(0)",
          contain: "paint",
        }}
      >
        {TABS.map((tab) => (
          <div
            key={tab.id}
            role="tabpanel"
            id={`demo-panel-${tab.id}`}
            aria-labelledby={`demo-tab-${tab.id}`}
            hidden={active !== tab.id}
            style={{ height: "100%", overflow: "auto" }}
          >
            <DemoShell active={tab.id}>
              {tab.id === "owner" ? <OwnerScreen /> : <BuyerScreen />}
            </DemoShell>
          </div>
        ))}
      </div>

      <p style={{ margin: 0, fontSize: "var(--fs-label)", color: "var(--muted)" }}>
        Demonstração com dados de exemplo. Nada do que aqui vê é uma conta real.
      </p>
    </div>
  );
}
