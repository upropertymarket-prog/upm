import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import { ToastProvider } from "../../../../packages/ui/src/components/Toast";
import { InternalChrome } from "../../../../apps/interno/src/components/InternalChrome";
import "../../_estilos/shell-no-canvas.css";
import { MailboxView } from "../../../../apps/interno/src/app/suporte/email/MailboxView";
import ptMessages from "../../../../packages/config/messages/pt.json";
// A folha do cliente de correio. Sem ela a storyboard mostrava três colunas sem
// moldura — este ecrã é o CSS tanto como é o JSX.
import "../../../../apps/interno/src/app/suporte/email/mailbox.css";
import {
  ASSINATURA,
  MAILBOXES,
  MAIL_COUNTS,
  MAIL_LABELS,
  MAIL_LIST,
  MAIL_SELECTED,
} from "../../_fixtures/mail";
import { TEMPLATE_ROWS } from "../../_fixtures/marketing";

/**
 * Caixa de e-mail do Admin — `/admin/email` (26 out 2026 · 07 §5.10)
 * =========================================================================
 * **A segunda porta da caixa de e-mail, e a razão desta storyboard é a
 * diferença entre as duas.** É o mesmo `MailboxView` de `/suporte/email` — o
 * componente verdadeiro, as mesmas fixtures do mesmo ficheiro — sob o shell do
 * Admin. Ao lado das storyboards de `canvases/suporte`, o que muda fica visível
 * de uma vez: o papel, o grupo da barra lateral, os contadores… e um botão a
 * menos.
 *
 * ## O botão que falta é o assunto
 *
 * **Não se passa o `onCreateTicket`**, exactamente como a rota não o passa.
 * Criar um ticket a partir de um e-mail é a única ação desta caixa que sai do
 * correio para a fila de outra pessoa, e 07 §5.10 reserva o workflow de tickets
 * ao Suporte — é a mesma razão por que `/admin/tickets` é só de leitura. Sem a
 * prop o botão não se desenha, e `create_ticket_from_mail` continua a recusar o
 * Admin do lado da base de dados, que é o que torna isto uma regra e não uma
 * escolha de ecrã. Quem revê esta storyboard contra a do Suporte vê a regra, não
 * lê sobre ela.
 *
 * O que **não** é diferente: a leitura, os marcadores, a estrela, o arquivo, as
 * etiquetas, os rascunhos, o envio e os anexos na Cloud. Foram alargados a
 * `is_staff()` por `20261026120000_mail_admin_door.sql`.
 *
 * ## Porque são duas molduras
 *
 * - **Com mensagem aberta** — o ecrã a trabalhar: as três colunas, a lista com
 *   uma por ler e o corpo do e-mail dentro do `iframe` com `sandbox`
 *   (02 §4.3). É o estado que prova o desenho, e é onde se conta o botão que
 *   não está lá.
 * - **Sem caixas configuradas** — e este é o estado **real de hoje**: não há
 *   nenhuma caixa criada na Amen. Quem abrir `/admin/email` esta semana vê
 *   isto, e no Admin o vazio é mais útil do que em qualquer outro papel: a
 *   Configuração de e-mail que ele manda consultar é a entrada seguinte do seu
 *   próprio menu.
 *
 * **Nenhuma storyboard escreve.** Aqui a regra tem dentes — `onFlags` marcaria
 * correio real como lido. Uma maqueta não trabalha a caixa de ninguém.
 */

/** Ver a nota de topo: nenhuma destas ações chega à base de dados. */
const semEscrita = async () => ({ ok: true });

function CaixaAdminDemo({
  theme,
  mailboxes,
  selected,
}: {
  theme: "light" | "dark";
  mailboxes: typeof MAILBOXES;
  selected: typeof MAIL_SELECTED | null;
}) {
  return (
    // `height` e não `minHeight`: o cliente de correio herda a altura do shell
    // em `fill`, e sem uma altura fechada aqui as três colunas ficariam do
    // tamanho do texto.
    <div data-theme={theme} style={{ height: "900px", background: "var(--bg)" }}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <ThemeProvider initialChoice={theme}>
          <ToastProvider>
            <InternalChrome
              role="admin"
              userName="Helena Matos"
              userMeta="Administração · IT"
              activeId="mailbox"
              locale="pt"
              onLocaleChange={async () => undefined}
              counters={{
                propertyModeration: 4,
                siteLeads: 12,
                mailbox: mailboxes.length > 0 ? MAIL_COUNTS.unread : 0,
              }}
              fill
            >
              <MailboxView
                mailboxes={mailboxes}
                mailboxId={mailboxes[0]?.id ?? null}
                folder="inbox"
                labels={mailboxes.length > 0 ? MAIL_LABELS : []}
                labelId={null}
                search=""
                starred={false}
                messages={mailboxes.length > 0 ? MAIL_LIST : []}
                selected={selected}
                counts={MAIL_COUNTS}
                locale="pt"
                onFlags={semEscrita}
                onMove={semEscrita}
                onCreateLabel={semEscrita}
                onToggleLabel={semEscrita}
                onSync={semEscrita}
                /**
                 * O compositor do Admin tem os modelos do Marketing, como o do
                 * Suporte: quem os escreve é o Marketing, quem os usa é quem
                 * responde (07 §24.6).
                 */
                templates={TEMPLATE_ROWS}
                signature={ASSINATURA}
                onSaveDraft={semEscrita}
                onSend={semEscrita}
                onDiscardDraft={semEscrita}
                /**
                 * Não devolvem URL de propósito: um URL assinado sai de uma ida
                 * ao servidor, e a maqueta não tem servidor. Os botões aparecem
                 * porque são parte do ecrã que se está a revê.
                 */
                onAttachmentLink={semEscrita}
                onAttachmentToCloud={semEscrita}
              />
            </InternalChrome>
          </ToastProvider>
        </ThemeProvider>
      </NextIntlClientProvider>
    </div>
  );
}

export function AdminCaixaEmailClaro() {
  return <CaixaAdminDemo theme="light" mailboxes={MAILBOXES} selected={MAIL_SELECTED} />;
}

export function AdminCaixaEmailEscuro() {
  return <CaixaAdminDemo theme="dark" mailboxes={MAILBOXES} selected={MAIL_SELECTED} />;
}

/** O estado real de hoje: nenhuma caixa criada ainda. */
export function AdminCaixaEmailSemCaixas() {
  return <CaixaAdminDemo theme="light" mailboxes={[]} selected={null} />;
}

export function AdminCaixaEmailSemCaixasEscuro() {
  return <CaixaAdminDemo theme="dark" mailboxes={[]} selected={null} />;
}
