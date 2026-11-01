import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import { ToastProvider } from "../../../../packages/ui/src/components/Toast";
import { InternalChrome } from "../../../../apps/interno/src/components/InternalChrome";
import "../../_estilos/shell-no-canvas.css";
import { SignatureManager } from "../../../../apps/interno/src/app/suporte/assinaturas/SignatureManager";
import ptMessages from "../../../../packages/config/messages/pt.json";
// A folha do editor: as três colunas são o CSS tanto como são o JSX.
import "../../../../apps/interno/src/app/suporte/assinaturas/signatures.css";
import { MAILBOXES, MAIL_COUNTS } from "../../_fixtures/mail";
import { HTML_COM_AVISOS, SIGNATURE, VARIAVEIS_RESOLVIDAS } from "../../_fixtures/signatures";

/**
 * Assinaturas de e-mail — `/suporte/assinaturas` (P10-06 · 04 §2.6)
 * =========================================================================
 * É o `SignatureManager` verdadeiro. O que entra por prop são os dados
 * (`../../_fixtures/signatures`) e duas ações que não chegam a lado nenhum.
 *
 * **Nenhuma storyboard escreve.** `onSave` gravaria uma assinatura a sério e
 * mudava o que sai no correio de toda a equipa.
 *
 * ## O `onInspect` daqui não é o da app
 *
 * Na app, os avisos e a pré-visualização vêm do servidor: o sanitizador
 * (`inspectSignature`) e a resolução das variáveis na base de dados. Nenhum dos
 * dois corre no canvas, por isso esta função **imita** a resposta — troca as
 * variáveis pelos dados da Helena e devolve os avisos que o servidor daria ao
 * HTML de `HTML_COM_AVISOS`. Serve para mostrar o ecrã, não para provar o
 * sanitizador: esse tem os seus testes em `packages/db/src/signatures.test.ts`.
 *
 * ## Porque são três molduras
 *
 * - **A editar** — o ecrã a trabalhar: HTML e pré-visualização. Desde 29 out
 *   2026 há uma assinatura só para toda a empresa, e a lista saiu.
 * - **Com avisos** — HTML colado com um `<script>`, um `onclick=` e uma
 *   variável que não existe (`{{telemovel}}`). É o estado que justifica o
 *   editor ser de código. Nenhum dos três mexe no desenho da assinatura.
 * - **Antes da primeira** — o editor abre no desenho de partida.
 */

const semEscrita = async () => ({ ok: true });

const VARIAVEL = /\{\{\s*([a-zA-Z_]+)\s*\}\}/g;

async function inspecionarNoCanvas(input: Record<string, unknown>) {
  const html = String(input.html ?? "");
  const findings: { kind: "unsafe" | "unknownVariable"; detail: string }[] = [];
  if (/<script/i.test(html)) findings.push({ kind: "unsafe", detail: "<script>" });
  for (const match of html.matchAll(/\s(on[a-z]+)\s*=/gi)) {
    findings.push({ kind: "unsafe", detail: `${match[1]!.toLowerCase()}=` });
  }

  const used = new Set<string>();
  for (const match of html.matchAll(VARIAVEL)) {
    const name = match[1]!.toLowerCase();
    if (name in VARIAVEIS_RESOLVIDAS) used.add(name);
    else findings.push({ kind: "unknownVariable", detail: `{{${match[1]}}}` });
  }

  const limpo = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/\son[a-z]+="[^"]*"/gi, "");
  const preview = input.mailboxId
    ? limpo.replace(
        VARIAVEL,
        (token, name: string) => VARIAVEIS_RESOLVIDAS[name.toLowerCase()] ?? token,
      )
    : limpo;

  return { findings, preview, variables: [...used] };
}

function AssinaturasDemo({
  theme,
  signature,
}: {
  theme: "light" | "dark";
  signature: typeof SIGNATURE | null;
}) {
  return (
    <div data-theme={theme} style={{ height: "900px", background: "var(--bg)" }}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <ThemeProvider initialChoice={theme}>
          <ToastProvider>
            <InternalChrome
              role="support"
              userName="Helena Matos"
              userMeta="Suporte · Apoio ao cliente"
              activeId="signatures"
              locale="pt"
              onLocaleChange={async () => undefined}
              counters={{ mailbox: MAIL_COUNTS.unread, tickets: 3 }}
            >
              <SignatureManager
                signature={signature}
                mailboxes={MAILBOXES}
                onSave={semEscrita}
                onInspect={inspecionarNoCanvas}
              />
            </InternalChrome>
          </ToastProvider>
        </ThemeProvider>
      </NextIntlClientProvider>
    </div>
  );
}

const COM_AVISOS = { ...SIGNATURE, html: HTML_COM_AVISOS };

export function SuporteAssinaturasClaro() {
  return <AssinaturasDemo theme="light" signature={SIGNATURE} />;
}

export function SuporteAssinaturasEscuro() {
  return <AssinaturasDemo theme="dark" signature={SIGNATURE} />;
}

/** HTML colado com o que o sanitizador vai tirar, e uma variável que não existe. */
export function SuporteAssinaturasAvisos() {
  return <AssinaturasDemo theme="light" signature={COM_AVISOS} />;
}

export function SuporteAssinaturasAvisosEscuro() {
  return <AssinaturasDemo theme="dark" signature={COM_AVISOS} />;
}

/** Antes da primeira gravação: o editor abre no desenho de partida. */
export function SuporteAssinaturasVazio() {
  return <AssinaturasDemo theme="light" signature={null} />;
}

export function SuporteAssinaturasVazioEscuro() {
  return <AssinaturasDemo theme="dark" signature={null} />;
}
