import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import { ToastProvider } from "../../../../packages/ui/src/components/Toast";
import { InternalChrome } from "../../../../apps/interno/src/components/InternalChrome";
import { TicketsManager } from "../../../../apps/interno/src/app/suporte/tickets/TicketsManager";
import ptMessages from "../../../../packages/config/messages/pt.json";
import { TICKET_COUNTS, TICKET_DETAIL, TICKET_HISTORY, TICKET_ROWS } from "../../_fixtures/tickets";

/**
 * Tickets do Suporte — `/suporte/tickets` (P10-02 · 04 §2.6)
 * =========================================================================
 * É o `TicketsManager` verdadeiro, com `InternalChrome` em volta: o mesmo
 * invólucro fino das storyboards do Admin. O que entra por prop são os dados
 * (`../../_fixtures/tickets`) e um `onSave` que não escreve em lado nenhum.
 *
 * **Nenhuma storyboard chama `saveTicketStatus`.** Mudar o estado de um ticket
 * notifica quem o reportou (`ticket_events` → `notify`): um clique numa maqueta
 * não pode disparar um e-mail a um utilizador. O `Guardar e notificar` aparece
 * porque é parte do ecrã que se está a revê — mas não vai a sítio nenhum.
 *
 * ## Porque são três estados, e não um
 *
 * O ecrã é uma fila de trabalho, e uma fila tem três situações que se desenham
 * de maneira diferente:
 *
 *  - **Com um ticket aberto** — o par lista + detalhe lado a lado de 04 §2.6,
 *    que é a razão de este ecrã não ser um drawer: o Suporte trabalha um ticket
 *    com a fila à vista.
 *  - **Sem ticket aberto** — é o ecrã de quem acaba de entrar, e o mais visto
 *    de todos. Se o painel da direita não disser o que fazer, a primeira
 *    impressão do ecrã é um vazio inexplicado.
 *  - **Fila vazia** — a tab "Fechados" no primeiro dia, ou "Por tratar" num bom
 *    dia. O `EmptyState` tem de dizer que não há nada a tratar, e não parecer
 *    que a lista falhou a carregar.
 *
 * O detalhe tem os factos técnicos e as "últimas ações" abertos: é o bloco onde
 * o ecrã parte primeiro, porque é o único cujo comprimento vem do browser de
 * quem reportou e não de nós.
 */

/** Ver a nota de topo: guardar não escreve, e não notifica ninguém. */
const semEscrita = async () => ({});

function SuporteTicketsDemo({
  theme,
  rows,
  selected,
}: {
  theme: "light" | "dark";
  rows: typeof TICKET_ROWS;
  selected: typeof TICKET_DETAIL | null;
}) {
  return (
    <div data-theme={theme} style={{ minHeight: "900px", background: "var(--bg)" }}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <ThemeProvider initialChoice={theme}>
          <ToastProvider>
            <InternalChrome
              role="support"
              userName="Helena Matos"
              userMeta="Suporte · Apoio ao cliente"
              activeId="tickets"
              locale="pt"
              onLocaleChange={async () => undefined}
              counters={{ tickets: TICKET_COUNTS.pending }}
            >
              <TicketsManager
                rows={rows}
                counts={TICKET_COUNTS}
                tab="pending"
                search=""
                selected={selected}
                history={selected ? TICKET_HISTORY : []}
                onSave={semEscrita}
              />
            </InternalChrome>
          </ToastProvider>
        </ThemeProvider>
      </NextIntlClientProvider>
    </div>
  );
}

export function SuporteTicketsClaro() {
  return <SuporteTicketsDemo theme="light" rows={TICKET_ROWS} selected={TICKET_DETAIL} />;
}

export function SuporteTicketsEscuro() {
  return <SuporteTicketsDemo theme="dark" rows={TICKET_ROWS} selected={TICKET_DETAIL} />;
}

/** O ecrã de quem acaba de entrar no Suporte. */
export function SuporteTicketsSemSelecao() {
  return <SuporteTicketsDemo theme="light" rows={TICKET_ROWS} selected={null} />;
}

export function SuporteTicketsSemSelecaoEscuro() {
  return <SuporteTicketsDemo theme="dark" rows={TICKET_ROWS} selected={null} />;
}

/** Um bom dia — ou o primeiro. */
export function SuporteTicketsFilaVazia() {
  return <SuporteTicketsDemo theme="light" rows={[]} selected={null} />;
}

export function SuporteTicketsFilaVaziaEscuro() {
  return <SuporteTicketsDemo theme="dark" rows={[]} selected={null} />;
}
