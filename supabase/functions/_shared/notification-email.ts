/**
 * O e-mail transacional (D27 · 02 §10)
 * =========================================================================
 * `notify()` enfileira em `notification_deliveries` com `template` = o tipo da
 * notificação e `payload` = `{ title, body, link }` (ver
 * `20260929120100_notifications.sql`). Daqui sai o HTML que o Resend entrega.
 *
 * **Isto não é React Email, e é de propósito.** O React Email entra com as
 * campanhas (P10-08), onde o conteúdo é composto por blocos num construtor
 * visual e precisa de um renderizador a sério. Uma notificação transacional é
 * sempre a mesma coisa — um título, um parágrafo e, às vezes, um botão —, e
 * fazê-la passar por um renderizador de componentes era acrescentar uma
 * dependência de UI a um processo que não tem UI.
 *
 * **Tudo em estilos inline e tabelas.** Não é desleixo: o Gmail remove `<style>`
 * de cabeçalho e o Outlook não entende `flex` nem `grid`. As cores estão aqui
 * em hexadecimal — a única exceção à regra de 04 §5.1 — porque um cliente de
 * e-mail não tem as `custom properties` do design system; os valores são os
 * tokens do tema claro de `packages/ui/src/styles/tokens.css`, copiados com o
 * nome do token ao lado para se saber de onde vieram quando a paleta mudar.
 */

const ACCENT = "#ff6a00"; // --accent
const TEXT = "#14161a"; // --text
const MUTED = "#5d6470"; // --muted
const BORDER = "#e4e7ec"; // --border
const SURFACE = "#ffffff"; // --surface
const BACKGROUND = "#f6f7f9"; // --bg

/**
 * O `cta`, o `footer` e o `lang` entraram com a confirmação de pré-inscrição
 * (P2-02) e são todos **opcionais**, com as predefinições de sempre: as
 * entregas que o `notify()` enfileira não mudam uma letra.
 *
 * Existem porque o destinatário deixou de ser necessariamente um utilizador.
 * Os dois textos por omissão dizem "Abrir na app" e "tem uma conta na
 * UProperty Market" — e as duas coisas são falsas para quem acabou de deixar
 * o e-mail num formulário público: não tem app para abrir nem conta nenhuma.
 *
 * Vêm por `payload`, e não de um `if` por tipo de template aqui dentro, pela
 * mesma razão por que os componentes de `@upm/ui` recebem rótulos por props: o
 * worker não sabe falar duas línguas — quem enfileira sabe em que língua a
 * pessoa estava.
 */
export type DeliveryPayload = {
  title?: unknown;
  body?: unknown;
  link?: unknown;
  cta?: unknown;
  footer?: unknown;
  lang?: unknown;
  /** Uma frase depois do botão e antes da assinatura ("Obrigado pelo seu interesse…"). */
  closing?: unknown;
  /** O nome na assinatura ("A Equipa UProperty Market"). */
  signoff?: unknown;
  /**
   * Uma linha a mais no rodapé, com um link — "Mudou de ideias? Remover a
   * minha pré-inscrição" (8 nov 2026). As três ou nenhuma.
   */
  optOutText?: unknown;
  optOutLabel?: unknown;
  optOutLink?: unknown;
};

export type RenderedEmail = { subject: string; html: string; text: string };

const DEFAULT_CTA = "Abrir na app";
const DEFAULT_FOOTER =
  "Recebeu este e-mail porque tem uma conta na UProperty Market. Pode escolher que avisos recebe em Definições › Notificações.";
const DEFAULT_SIGNOFF = "A Equipa UProperty Market";

/**
 * Os contactos da assinatura (cliente, 8 nov 2026). Iguais nas duas línguas:
 * só o nome da equipa se traduz (`signoff`).
 */
const SIGNATURE_PHONE = "(+351) 939 732 637";
const SIGNATURE_PHONE_LINK = "tel:+351939732637";
const SIGNATURE_EMAIL = "info@upropertymarket.pt";
const SIGNATURE_WEB = "www.upropertymarket.pt";

/**
 * O site público, de onde vem a imagem da assinatura. Um e-mail não leva
 * anexos de imagem: a imagem é pedida ao site quando o e-mail é aberto.
 */
const DEFAULT_SITE_URL = "https://upropertymarket.pt";

export function renderNotificationEmail(
  payload: DeliveryPayload,
  options: { appUrl: string; siteUrl?: string },
): RenderedEmail {
  const title = text(payload.title) || "Novidade na UProperty Market";
  const body = text(payload.body);
  const link = absolute(text(payload.link), options.appUrl);
  const cta = text(payload.cta) || DEFAULT_CTA;
  const footer = text(payload.footer) || DEFAULT_FOOTER;
  const lang = /^[a-z]{2}$/i.test(text(payload.lang)) ? text(payload.lang).toLowerCase() : "pt";
  const closing = text(payload.closing);
  const signoff = text(payload.signoff) || DEFAULT_SIGNOFF;
  const siteUrl = (options.siteUrl || DEFAULT_SITE_URL).replace(/\/+$/, "");
  const optOutLink = /^https?:\/\//i.test(text(payload.optOutLink)) ? text(payload.optOutLink) : "";
  const optOut =
    optOutLink && text(payload.optOutText) && text(payload.optOutLabel)
      ? { text: text(payload.optOutText), label: text(payload.optOutLabel), link: optOutLink }
      : null;

  const plain = [
    title,
    body,
    link ? `${cta}: ${link}` : "",
    closing,
    [signoff, `Tel: ${SIGNATURE_PHONE}`, `Email: ${SIGNATURE_EMAIL}`, `Web: ${SIGNATURE_WEB}`].join(
      "\n",
    ),
    footer,
    optOut ? `${optOut.text} ${optOut.label}: ${optOut.link}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    subject: title,
    html: layout({ title, body, link, cta, closing, footer, lang, signoff, siteUrl, optOut }),
    text: plain,
  };
}

function layout({
  title,
  body,
  link,
  cta,
  closing,
  footer,
  lang,
  signoff,
  siteUrl,
  optOut,
}: {
  title: string;
  body: string;
  link: string;
  cta: string;
  closing: string;
  footer: string;
  lang: string;
  signoff: string;
  siteUrl: string;
  optOut: { text: string; label: string; link: string } | null;
}): string {
  const button = link
    ? `<tr><td style="padding:24px 32px 0 32px">
         <a href="${escape(link)}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:10px">${escape(cta)}</a>
       </td></tr>`
    : "";

  const paragraph = body
    ? `<tr><td style="padding:12px 32px 0 32px;font-size:15px;line-height:1.55;color:${TEXT}">${escape(body).replace(/\n/g, "<br>")}</td></tr>`
    : "";

  const closingRow = closing
    ? `<tr><td style="padding:24px 32px 0 32px;font-size:15px;line-height:1.55;color:${TEXT}">${escape(closing)}</td></tr>`
    : "";

  // A assinatura da UProperty Market (cliente, 8 nov 2026): o logótipo à
  // esquerda (`public/brand/assinatura-light.png`, 600×201) e, separados por
  // uma linha, o nome da equipa e os contactos. Dois blocos `inline-block` e
  // não duas células: num telemóvel estreito empilham, em vez de alargarem o
  // e-mail para fora do ecrã. O `alt` diz o nome da marca a quem tem as
  // imagens bloqueadas — o caso por omissão no Outlook.
  const contact = (label: string, value: string, href: string) =>
    `<tr><td style="padding:3px 14px 3px 0;font-size:13px;color:${MUTED};white-space:nowrap">${label}</td><td style="padding:3px 0;font-size:14px;white-space:nowrap"><a href="${escape(href)}" style="color:${TEXT};text-decoration:none">${escape(value)}</a></td></tr>`;
  const signature = `<tr><td style="padding:32px 32px 0 32px">
         <div class="upm-sig-logo" style="display:inline-block;vertical-align:middle;padding:8px 24px 8px 0">
           <a href="${escape(siteUrl)}"><img src="${escape(siteUrl)}/brand/assinatura-light.png" width="150" height="50" alt="UProperty Market" style="display:block;border:0;width:150px;height:auto"></a>
         </div>
         <div class="upm-sig-text" style="display:inline-block;vertical-align:middle;padding:4px 0 4px 24px;border-left:1px solid ${BORDER}">
           <div style="font-size:15px;font-weight:700;color:${TEXT};padding-bottom:8px">${escape(signoff)}</div>
           <table role="presentation" cellpadding="0" cellspacing="0">
             ${contact("Tel:", SIGNATURE_PHONE, SIGNATURE_PHONE_LINK)}
             ${contact("Email:", SIGNATURE_EMAIL, `mailto:${SIGNATURE_EMAIL}`)}
             ${contact("Web:", SIGNATURE_WEB, siteUrl)}
           </table>
         </div>
       </td></tr>`;

  const optOutLine = optOut
    ? `<br><br>${escape(optOut.text)} <a href="${escape(optOut.link)}" style="color:${MUTED};text-decoration:underline">${escape(optOut.label)}</a>`
    : "";

  return `<!doctype html>
<html lang="${escape(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(title)}</title>
<style>
  /* Telemóvel (cliente, 8 nov 2026): a assinatura empilha, e aí o texto fica
     alinhado à esquerda com o logótipo, sem a linha vertical e com mais
     espaço por baixo do logótipo. Os clientes que ignoram <style> mantêm o
     desenho de computador, que só fica com a linha — nada se parte. */
  @media (max-width: 540px) {
    .upm-sig-logo { display: block !important; padding: 0 0 20px 0 !important; }
    .upm-sig-text { display: block !important; padding: 0 !important; border-left: 0 !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${BACKGROUND};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BACKGROUND};padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${SURFACE};border:1px solid ${BORDER};border-radius:16px">
        <tr><td style="padding:32px 32px 0 32px;font-size:18px;font-weight:700;color:${TEXT}">${escape(title)}</td></tr>
        ${paragraph}
        ${button}
        ${closingRow}
        ${signature}
        <!-- O espaço antes da linha do rodapé é uma linha da tabela: um
             margin-top numa célula não conta em nenhum cliente de e-mail, e
             até 8 nov a linha cinzenta ficava colada ao botão. -->
        <tr><td style="height:32px;line-height:32px;font-size:0">&nbsp;</td></tr>
        <tr><td style="padding:24px 32px 32px 32px;font-size:12.5px;line-height:1.5;color:${MUTED};border-top:1px solid ${BORDER}">
          ${escape(footer)}${optOutLine}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Um `link` da fila é relativo (`/mensagens/123`); o e-mail precisa de absoluto. */
function absolute(link: string, appUrl: string): string {
  if (!link) return "";
  if (/^https?:\/\//i.test(link)) return link;
  return `${appUrl.replace(/\/$/, "")}/${link.replace(/^\//, "")}`;
}

/**
 * O conteúdo vem de `payload`, que é escrito por gatilhos da base de dados a
 * partir de nomes de utilizadores e títulos de imóveis — texto de terceiros.
 * Sem escape, um imóvel chamado `<script>` ia inteiro para dentro do HTML.
 */
function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
