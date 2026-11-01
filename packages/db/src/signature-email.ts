/**
 * O modo escuro da assinatura no e-mail que sai (31 out 2026)
 * =========================================================================
 * Sem dependências, de propósito: o mail-worker importa daqui para embrulhar o
 * que envia, e `signatures.ts` traz o `sanitize-html`, que o worker não precisa.
 */

/** As regras que trocam o logótipo claro pelo escuro. */
export const DARK_RULES = (scope: string) =>
  `${scope} .upm-sig-logo-light { display: none !important; }
${scope} .upm-sig-logo-dark { display: block !important; max-height: none !important; overflow: visible !important; }`;

/**
 * O modo escuro da assinatura, nos clientes de correio que o anunciam
 * =========================================================================
 * Nenhum cliente troca imagens sozinho; quem troca é esta folha, e cada
 * família de clientes avisa que está em escuro à sua maneira:
 *
 * - **Apple Mail, Mail do iOS, Outlook para Mac e iOS, Thunderbird** — pela
 *   media query `prefers-color-scheme`. O `<meta name="color-scheme">` diz-lhes
 *   que o e-mail sabe lidar com os dois temas, e por isso não o invertem à
 *   bruta: pintam o fundo e o texto que herda, e a folha troca o logótipo.
 * - **Outlook.com, Outlook na web e o novo Outlook do Windows** — não aplicam a
 *   media query; reescrevem as cores e marcam o que mexeram com `data-ogsc`. As
 *   regras com `[data-ogsc]` são as mesmas, por esse caminho.
 * - **App do Gmail e Outlook clássico do Windows** — invertem as cores e não
 *   leem nada disto. Fica o logótipo claro, com o halo (ver acima).
 *
 * **Não se grava com a assinatura.** A base de dados recusa `<style>` numa
 * assinatura (`email_signature_save`), e bem: dentro do composer seria uma
 * folha solta no meio do texto. É o envio que a acrescenta, no `<head>` do
 * documento — ver `wrapOutgoingEmail`.
 */
export const SIGNATURE_DARK_MODE_CSS = `:root { color-scheme: light dark; supported-color-schemes: light dark; }
@media (prefers-color-scheme: dark) {
${DARK_RULES("body")}
}
${DARK_RULES("[data-ogsc]")}`;

/**
 * O HTML do composer → o documento que sai pelo SMTP
 * =========================================================================
 * O composer produz um fragmento; um cliente de correio aceita-o, mas sem
 * `<head>` não há onde pôr o `color-scheme` nem a folha do modo escuro. Só
 * se embrulha o que ainda não é um documento, e a folha só entra quando o
 * e-mail traz a assinatura — uma resposta sem ela sai como sempre saiu.
 */
export function wrapOutgoingEmail(html: string): string {
  if (/<html[\s>]/i.test(html)) return html;
  const head = html.includes("upm-sig-")
    ? `<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><style>${SIGNATURE_DARK_MODE_CSS}</style>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8">${head}</head><body>${html}</body></html>`;
}
