import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import { ToastProvider } from "../../../../packages/ui/src/components/Toast";
import { InternalChrome } from "../../../../apps/interno/src/components/InternalChrome";
import "../../_estilos/shell-no-canvas.css";
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
 * ## Porque são quatro estados
 *
 * - **O construtor, num rascunho** — o estado em que o ecrã se usa, e o que
 *   faltava até 22 out 2026. Só num rascunho é que o `locked` o destranca.
 * - **Campanha enviada, com recibos** — é a única moldura em que as métricas
 *   existem. Os recibos não fecham a conta de propósito (180 entregues de
 *   184): um recibo pode não chegar, e o ecrã tem de mostrar a percentagem
 *   sobre o que sabe. Tudo nela está trancado — é o *depois*, não o fazer.
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
  /**
   * O e-mail aberto é o **primeiro da campanha escolhida**, e não um id fixo.
   *
   * Era `"eml-1"` à força, que pertence à `cmp-1`. Enquanto todas as
   * storyboards apontavam para essa campanha ninguém dava por isso — mas
   * bastou a do construtor abrir a `cmp-2` para o ecrã ficar com a sequência
   * de uma campanha e o e-mail de outra. O `?.id` é a mesma conta que a
   * `page.tsx` faz quando o URL não traz `?email=`.
   */
  const emails = selected ? CAMPAIGN_EMAILS.filter((e) => e.campaign_id === selected.id) : [];
  return (
    <div data-theme={theme} style={{ minHeight: "900px", background: "var(--bg)" }}>
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
                emails={emails}
                blocksByEmail={CAMPAIGN_BLOCKS_BY_EMAIL}
                delayByEmail={CAMPAIGN_DELAY_BY_EMAIL}
                selectedEmailId={emails[0]?.id ?? null}
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

/**
 * O construtor a construir — a storyboard que faltava (22 out 2026).
 * =========================================================================
 * `cmp-2` é um **rascunho**, e é essa a única coisa que a distingue: o
 * `locked` do `CampaignBuilder` é `status === "sending" || "sent"`, por isso
 * só num rascunho é que o ecrã se vê inteiro — o Guardar, a paleta dos dez
 * blocos clicável, os campos a aceitar texto, o "Adicionar e-mail", o
 * "Apagar campanha".
 *
 * Todas as outras cinco storyboards apontavam para a `cmp-1`, que está
 * `sent`. O que se revia era sempre o **depois**: campos cinzentos, paleta
 * desativada, recibos. P10-08 é o construtor, e o construtor não tinha
 * moldura nenhuma onde se visse a funcionar.
 *
 * Sem recibos de propósito: um rascunho nunca saiu, e `receipts` vem de
 * `email_events` — inventá-los aqui era desenhar um estado que a base de
 * dados não produz.
 */
export function MarketingCampanhasConstrutor() {
  return <CampanhasDemo theme="light" selected={CAMPAIGN_ROWS[1]!} scheduled={null} />;
}

export function MarketingCampanhasConstrutorEscuro() {
  return <CampanhasDemo theme="dark" selected={CAMPAIGN_ROWS[1]!} scheduled={null} />;
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
