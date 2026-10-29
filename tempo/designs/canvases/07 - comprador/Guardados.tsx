import { Bookmark } from "lucide-react";

import { EmptyState } from "../../../../packages/ui/src/components/EmptyState";
import { StatusTag } from "../../../../packages/ui/src/components/StatusTag";
import { Table, type TableColumn } from "../../../../packages/ui/src/components/Table";
import { AlertsManager } from "../../../../apps/app/src/components/market/AlertsManager";
import { formatCents } from "../../../../apps/app/src/lib/money";

import { Shell } from "./Shell";
import { demoAlertOk, demoAlerts, demoSaved, type DemoSavedRow } from "./demo";

/**
 * `/guardados` e `/guardados/alertas` — os imóveis guardados e os alertas.
 * =========================================================================
 *
 * ## Porque é que este ficheiro monta a tabela à mão
 *
 * Os outros ecrãs do comprador têm um componente de apresentação próprio —
 * `BuyerDashboard`, `VisitsScreen`, `AlertsManager` — e a storyboard limita-se
 * a montá-lo com dados fixos. Os Guardados não têm: o `page.tsx` é um
 * componente de servidor que resolve o Supabase **e** declara as colunas da
 * `Table` em linha, tudo no mesmo sítio.
 *
 * Não há aqui mock nenhum: a `Table`, a `StatusTag` e o `EmptyState` são os
 * componentes de produção, e as colunas são as mesmas quatro da página, pela
 * mesma ordem e com a mesma lógica. O que se duplica é a montagem, não a
 * aparência — e é o mesmo caminho que o `MapaDefinicoes.tsx` do canvas 06 já
 * tinha aberto para as Definições, que sofrem do mesmo.
 *
 * **Fica como dívida:** enquanto a montagem viver em dois sítios, mexer nas
 * colunas da página não se reflete na storyboard, e o canvas passa a mentir
 * sem ninguém dar por isso. A saída é extrair um `SavedScreen` do `page.tsx`,
 * como já existe para os outros ecrãs — mas isso é código da app e não cabia
 * nesta passagem, que é de canvas.
 *
 * ## Porque são três molduras
 *
 * - **Com imóveis** — o ecrã a trabalhar, com os três casos da última coluna.
 * - **Sem nenhum guardado** — o estado de quem acaba de criar conta, e o mais
 *   visto de todos. É o `EmptyState` com o caminho para o Market: sem ele, a
 *   primeira impressão do ecrã é uma tabela vazia que parece ter falhado.
 * - **Alertas** — `/guardados/alertas`, a sub-rota que o cabeçalho do ecrã
 *   oferece. Vive aqui e não num ficheiro próprio porque é o mesmo ecrã visto
 *   de outro ângulo: guardar um imóvel e guardar uma pesquisa.
 */

/** As mesmas quatro colunas do `page.tsx`, pela mesma ordem. */
const COLUNAS: TableColumn<DemoSavedRow>[] = [
  {
    id: "title",
    header: "Imóvel",
    cell: (row) => <a href={`/market/${row.propertyId}`}>{row.title}</a>,
  },
  {
    id: "deal",
    header: "Negócio",
    cell: (row) =>
      row.deal ? (
        <StatusTag tone={row.deal === "sale" ? "dealSale" : "dealRent"}>
          {row.deal === "sale" ? "Venda" : "Arrendamento"}
        </StatusTag>
      ) : (
        "—"
      ),
  },
  {
    id: "priceAtSave",
    header: "Preço ao guardar",
    numeric: true,
    cell: (row) => formatCents(row.priceAtSave),
  },
  {
    /**
     * A coluna que justifica o ecrã existir: guardar um imóvel serve para dar
     * pela mudança de preço. A etiqueta só aparece quando mudou mesmo — a
     * linha do Loft, que não mexeu, mostra o preço seco.
     */
    id: "currentPrice",
    header: "Preço atual",
    numeric: true,
    cell: (row) => {
      const mudou =
        row.priceAtSave !== null &&
        row.currentPrice !== null &&
        row.priceAtSave !== row.currentPrice;
      if (!mudou) return formatCents(row.currentPrice);
      const desceu = (row.currentPrice ?? 0) < (row.priceAtSave ?? 0);
      return (
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          {formatCents(row.currentPrice)}
          <StatusTag tone={desceu ? "active" : "rejected"}>{desceu ? "Desceu" : "Subiu"}</StatusTag>
        </span>
      );
    },
  },
];

function GuardadosDemo({ theme, rows }: { theme: "light" | "dark"; rows: DemoSavedRow[] }) {
  return (
    <Shell theme={theme} activeId="saved" title="Guardados" subtitle="Os imóveis que guardou">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 className="upm-card__title">Guardados</h1>
          <a href="/guardados/alertas">Alertas de pesquisa</a>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Bookmark size={40} />}
            title="Ainda não guardou nenhum imóvel"
            description="Explore o Market e guarde os imóveis que lhe interessam."
            action={
              <a href="/market" className="upm-btn upm-btn--primary upm-btn--md">
                Explorar Market
              </a>
            }
          />
        ) : (
          <Table
            caption="Imóveis guardados"
            columns={COLUNAS}
            rows={rows}
            rowKey={(row) => row.id}
          />
        )}
      </div>
    </Shell>
  );
}

export function CompradorGuardadosClaro() {
  return <GuardadosDemo theme="light" rows={demoSaved} />;
}

export function CompradorGuardadosEscuro() {
  return <GuardadosDemo theme="dark" rows={demoSaved} />;
}

export function CompradorGuardadosVazio() {
  return <GuardadosDemo theme="light" rows={[]} />;
}

export function CompradorGuardadosVazioEscuro() {
  return <GuardadosDemo theme="dark" rows={[]} />;
}

/**
 * `/guardados/alertas` — o `AlertsManager` verdadeiro.
 *
 * As três ações escrevem a sério na app (criam, alteram e apagam alertas de
 * pesquisa); aqui devolvem `{ ok: true }` e não saem daqui. O toast de
 * confirmação aparece na mesma, que é o comportamento que se quer rever.
 */
function AlertasDemo({ theme }: { theme: "light" | "dark" }) {
  return (
    <Shell
      theme={theme}
      activeId="saved"
      title="Alertas de pesquisa"
      subtitle="Avisamos quando entrar um imóvel que corresponda"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <a href="/guardados">← Voltar aos guardados</a>
        <AlertsManager
          alerts={demoAlerts}
          createAlert={demoAlertOk}
          updateAlert={demoAlertOk}
          deleteAlert={demoAlertOk}
        />
      </div>
    </Shell>
  );
}

export function CompradorAlertasClaro() {
  return <AlertasDemo theme="light" />;
}

export function CompradorAlertasEscuro() {
  return <AlertasDemo theme="dark" />;
}
