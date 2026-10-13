import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import { ToastProvider } from "../../../../packages/ui/src/components/Toast";
import { InternalChrome } from "../../../../apps/interno/src/components/InternalChrome";
import { MailboxView } from "../../../../apps/interno/src/app/suporte/email/MailboxView";
import ptMessages from "../../../../packages/config/messages/pt.json";
// A folha do cliente de correio. Sem ela a storyboard mostrava três colunas sem
// moldura — este ecrã é o CSS tanto como é o JSX.
import "../../../../apps/interno/src/app/suporte/email/mailbox.css";
import {
  MAILBOXES,
  MAIL_COUNTS,
  MAIL_LABELS,
  MAIL_LIST,
  MAIL_SELECTED,
} from "../../_fixtures/mail";

/**
 * Caixa de e-mail — `/suporte/email` (P10-04 · 04 §2.5)
 * =========================================================================
 * É o `MailboxView` verdadeiro. O que entra por prop são os dados
 * (`../../_fixtures/mail`) e cinco ações que não chegam a lado nenhum.
 *
 * **Nenhuma storyboard escreve.** Aqui a regra tem dentes: `onCreateTicket`
 * abriria um ticket a sério na fila do Suporte, e `onFlags` marcaria correio
 * real como lido. Uma maqueta não trabalha a caixa de ninguém.
 *
 * ## Porque são três molduras
 *
 * - **Com mensagem aberta** — o ecrã a trabalhar: as três colunas, a lista com
 *   uma por ler e uma com ticket, e o corpo do e-mail dentro do `iframe` com
 *   `sandbox` (02 §4.3). É o estado que prova o desenho.
 * - **Sem mensagem** — o ecrã de quem entra, com o painel da direita a dizer o
 *   que fazer em vez de um vazio.
 * - **Sem caixas configuradas** — e este é o estado **real de hoje**: não há
 *   nenhuma caixa criada na Amen. Quem abrir `/suporte/email` esta semana vê
 *   exatamente isto, e por isso tem de dizer onde se criam (Administração ›
 *   Configuração de e-mail) em vez de parecer uma lista que falhou a carregar.
 */

/** Ver a nota de topo: nenhuma destas ações chega à base de dados. */
const semEscrita = async () => ({ ok: true });

function CaixaDemo({
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
    // em `fill`, e sem uma altura fechada aqui as três colunas voltariam a ficar
    // do tamanho do texto — que é exactamente o que esta versão corrige.
    <div data-theme={theme} style={{ height: "900px", background: "var(--bg)" }}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <ThemeProvider initialChoice={theme}>
          <ToastProvider>
            <InternalChrome
              role="support"
              userName="Helena Matos"
              userMeta="Suporte · Apoio ao cliente"
              activeId="mailbox"
              locale="pt"
              onLocaleChange={async () => undefined}
              counters={{ mailbox: MAIL_COUNTS.unread, tickets: 3 }}
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
                onCreateTicket={semEscrita}
                onSync={semEscrita}
              />
            </InternalChrome>
          </ToastProvider>
        </ThemeProvider>
      </NextIntlClientProvider>
    </div>
  );
}

export function SuporteCaixaClaro() {
  return <CaixaDemo theme="light" mailboxes={MAILBOXES} selected={MAIL_SELECTED} />;
}

export function SuporteCaixaEscuro() {
  return <CaixaDemo theme="dark" mailboxes={MAILBOXES} selected={MAIL_SELECTED} />;
}

/** O ecrã de quem entra: fila à vista, nada aberto. */
export function SuporteCaixaSemSelecao() {
  return <CaixaDemo theme="light" mailboxes={MAILBOXES} selected={null} />;
}

export function SuporteCaixaSemSelecaoEscuro() {
  return <CaixaDemo theme="dark" mailboxes={MAILBOXES} selected={null} />;
}

/** O estado real de hoje: nenhuma caixa criada ainda. */
export function SuporteCaixaSemCaixas() {
  return <CaixaDemo theme="light" mailboxes={[]} selected={null} />;
}

export function SuporteCaixaSemCaixasEscuro() {
  return <CaixaDemo theme="dark" mailboxes={[]} selected={null} />;
}
