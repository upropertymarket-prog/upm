import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import { ToastProvider } from "../../../../packages/ui/src/components/Toast";
import { InternalChrome } from "../../../../apps/interno/src/components/InternalChrome";
import { CampaignBuilder } from "../../../../apps/interno/src/app/marketing/campanhas/CampaignBuilder";
import ptMessages from "../../../../packages/config/messages/pt.json";
import {
  CAMPAIGN_BLOCKS_BY_EMAIL,
  CAMPAIGN_DELAY_BY_EMAIL,
  CAMPAIGN_EMAILS,
  CAMPAIGN_PROPERTIES,
  CAMPAIGN_RECEIPTS,
  CAMPAIGN_ROWS,
  CAMPAIGN_SCHEDULED,
  CAMPAIGN_SENDERS,
} from "../../_fixtures/marketing";

/**
 * Campanhas — `/marketing/campanhas` (P10-08 · P10-09 · 04 §2.6)
 * =========================================================================
 * Segunda entrada do `MARKETING_NAV`. É o `CampaignBuilder` verdadeiro — o
 * construtor visual de blocos, a sequência de e-mails e os recibos — com o
 * `InternalChrome` em volta.
 *
 * **Nenhuma storyboard envia nada, e esta é a que mais importa.** `onSend`
 * expande a campanha em destinatários e entrega-a ao worker: um clique numa
 * maqueta mandaria e-mail a pessoas a sério. `onSend`, `onSendTest`,
 * `onSchedule` e `onUnschedule` devolvem `{}` e não chegam a lado nenhum. O
 * `onPreview` também não: a pré-visualização é HTML composto no servidor, e sem
 * servidor não há HTML — devolve vazio em vez de inventar uma maqueta do
 * e-mail, que divergiria do que o renderizador faz de verdade.
 *
 * ## Porque são três estados
 *
 * - **Campanha enviada, com recibos** — é a única moldura em que as métricas
 *   existem, e é por isso a que mostra o ecrã completo. Os recibos não fecham
 *   a conta de propósito (180 entregues de 184): um recibo pode não chegar, e o
 *   ecrã tem de mostrar a percentagem sobre o que sabe.
 * - **Agendamento falhado** — o único estado de `scheduled_sends` que obriga o
 *   ecrã a dizer algo a alguém (P10-09). Sem ele, o aviso nunca se revê.
 * - **Sem campanha escolhida** — o ecrã de quem acaba de entrar, e o mais
 *   visto. Se o painel da direita não disser o que fazer, a primeira impressão
 *   é um vazio inexplicado.
 */

const semEscrita = async () => ({});
/** Ver a nota de topo: sem servidor não há HTML, e não se inventa um. */
const semPreVisualizacao = async () => ({ html: "" });
const semContagem = async () => ({ count: 184 });

function CampanhasDemo({
  theme,
  selected,
  scheduled,
}: {
  theme: "light" | "dark";
  selected: (typeof CAMPAIGN_ROWS)[number] | null;
  scheduled: typeof CAMPAIGN_SCHEDULED | null;
}) {
  const enviada = selected?.status === "sent";
  return (
    <div data-theme={theme} style={{ minHeight: "1100px", background: "var(--bg)" }}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <ThemeProvider initialChoice={theme}>
          <ToastProvider>
            <InternalChrome
              role="marketing"
              userName="Marta Nunes"
              userMeta="Marketing · Comunicação"
              activeId="campaigns"
              locale="pt"
              onLocaleChange={async () => undefined}
            >
              <CampaignBuilder
                campaigns={CAMPAIGN_ROWS}
                selected={selected}
                emails={
                  selected ? CAMPAIGN_EMAILS.filter((e) => e.campaign_id === selected.id) : []
                }
                blocksByEmail={CAMPAIGN_BLOCKS_BY_EMAIL}
                delayByEmail={CAMPAIGN_DELAY_BY_EMAIL}
                selectedEmailId={selected ? "eml-1" : null}
                senders={CAMPAIGN_SENDERS}
                properties={CAMPAIGN_PROPERTIES}
                audienceCount={selected ? 184 : null}
                receipts={enviada ? CAMPAIGN_RECEIPTS : []}
                scheduled={scheduled}
                locale="pt"
                onSaveCampaign={semEscrita}
                onDeleteCampaign={semEscrita}
                onSaveEmail={semEscrita}
                onDeleteEmail={semEscrita}
                onSchedule={semEscrita}
                onUnschedule={semEscrita}
                onSend={semEscrita}
                onSendTest={semEscrita}
                onCountAudience={semContagem}
                onPreview={semPreVisualizacao}
                onUploadImage={semEscrita}
              />
            </InternalChrome>
          </ToastProvider>
        </ThemeProvider>
      </NextIntlClientProvider>
    </div>
  );
}

export function MarketingCampanhasClaro() {
  return <CampanhasDemo theme="light" selected={CAMPAIGN_ROWS[0]!} scheduled={null} />;
}

export function MarketingCampanhasEscuro() {
  return <CampanhasDemo theme="dark" selected={CAMPAIGN_ROWS[0]!} scheduled={null} />;
}

/** P10-09 — o agendamento que não disparou, com o erro do servidor à vista. */
export function MarketingCampanhasAgendamentoFalhado() {
  return (
    <CampanhasDemo theme="light" selected={CAMPAIGN_ROWS[0]!} scheduled={CAMPAIGN_SCHEDULED} />
  );
}

export function MarketingCampanhasAgendamentoFalhadoEscuro() {
  return <CampanhasDemo theme="dark" selected={CAMPAIGN_ROWS[0]!} scheduled={CAMPAIGN_SCHEDULED} />;
}

/** O ecrã de quem acaba de entrar: a lista à vista, nada aberto. */
export function MarketingCampanhasSemSelecao() {
  return <CampanhasDemo theme="light" selected={null} scheduled={null} />;
}

export function MarketingCampanhasSemSelecaoEscuro() {
  return <CampanhasDemo theme="dark" selected={null} scheduled={null} />;
}
