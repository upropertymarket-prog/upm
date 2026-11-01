import sanitizeHtml from "sanitize-html";
import { z } from "zod";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "./database.types";
import { DARK_RULES } from "./signature-email";

export { SIGNATURE_DARK_MODE_CSS, wrapOutgoingEmail } from "./signature-email";

/**
 * Assinaturas de e-mail (P10-06 · 04 §2.6 · 05 §1.8 · 02 §4.3)
 * =========================================================================
 * Uma assinatura é **HTML escrito à mão** — quase sempre colado de um
 * designer ou de outro cliente de correio — e é injetado no corpo de um e-mail
 * que sai em nome da empresa. Duas consequências, e as duas vivem aqui:
 *
 * 1. **Sanitiza-se na escrita, no servidor.** 02 §4.3 nomeia o mecanismo
 *    (`DOMPurify`/`sanitize-html` no servidor) e é este. Não é defesa contra o
 *    próprio Suporte — é defesa contra o que ele cola: um `<script>` esquecido
 *    num bloco copiado de um site, um `onerror=` dentro de um `<img>`, um
 *    `javascript:` num link. O Composer insere a assinatura por `innerHTML`
 *    (ver `Composer.tsx`), por isso o que estiver guardado **corre** no
 *    browser de quem escreve. Sanitizar na leitura seria tarde: a linha já
 *    estava gravada e o próximo a lê-la podia não passar por aqui.
 * 2. **Avisa-se antes de guardar.** O que o sanitizador tira, tira em
 *    silêncio; `inspectSignature` diz **o que** vai sair e **que variáveis**
 *    não existem, para quem escreve não descobrir pela ausência.
 *
 * ## A lista do que passa, e porquê é tão curta
 *
 * Uma assinatura é uma tabela com um logótipo, texto, um traço e links. Não é
 * uma página: não tem formulários, não tem `<style>` (que vazaria para o corpo
 * do e-mail de quem responde), não tem `<script>` e não tem iframes. O que
 * **tem** de passar são os atributos de estilo em linha e as tabelas — é com
 * eles que uma assinatura se desenha, porque metade dos clientes de correio
 * ignora tudo o resto (04 §2.6 descreve o desenho: logótipo ao topo, traço
 * vertical neutro, nome / cargo·departamento / e-mail / telefone / slogan,
 * **sem fundo**, a herdar a cor do contexto).
 */

/** 05 §1.8 — as seis, e só estas. */
export const SIGNATURE_VARIABLES = [
  "nome",
  "cargo",
  "departamento",
  "email",
  "telefone",
  "iniciais",
] as const;

export type SignatureVariable = (typeof SIGNATURE_VARIABLES)[number];

/** Do ficheiro gerado desde 21 out 2026 (D64): era um tipo à mão em `pending-types.ts`. */
export type EmailSignatureRow = Tables<"email_signatures">;

type AnySupabaseClient = SupabaseClient<Database>;

/**
 * `style` em linha passa; `class` e `id` não
 * =========================================================================
 * Uma `class` numa assinatura não tem folha de estilos que a sirva — nem a
 * nossa app, nem o Gmail de quem recebe —, por isso não faz nada e dá a
 * ilusão de fazer. O `style` em linha é o único que atravessa os clientes de
 * correio, e é por isso que é o único que fica.
 *
 * `target` e `rel` nos links: uma assinatura abre no exterior, e um
 * `noopener noreferrer` acrescentado por nós é mais barato do que explicar
 * porque é que não estava lá.
 */
const POLICY: sanitizeHtml.IOptions = {
  allowedTags: [
    "a",
    "b",
    "br",
    "div",
    "em",
    "hr",
    "i",
    "img",
    "li",
    "ol",
    "p",
    "span",
    "strong",
    "table",
    "tbody",
    "td",
    "tr",
    "u",
    "ul",
  ],
  allowedAttributes: {
    a: ["href", "title", "style", "target", "rel"],
    img: ["src", "alt", "width", "height", "style"],
    table: ["style", "cellpadding", "cellspacing", "border", "width"],
    td: ["style", "width", "align", "valign"],
    tr: ["style"],
    "*": ["style", "dir"],
  },
  // `http`, `https` e `mailto` para links; `data:` só para a imagem, que é
  // como um logótipo viaja dentro de um e-mail sem depender do nosso servidor.
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https", "data"] },
  allowedSchemesAppliedToAttributes: ["href", "src"],
  allowProtocolRelative: false,
  // A única exceção ao "sem `class`": as do modo escuro (ver
  // `SIGNATURE_DARK_MODE_CSS`), que o envio serve com uma folha nossa. Só o
  // prefixo `upm-sig-`; qualquer outra classe continua a sair.
  allowedClasses: { "*": ["upm-sig-*"] },
  // Sem isto, `sanitize-html` deixa o **conteúdo** de um `<script>` como texto:
  // o código desaparecia da marcação e aparecia escrito na assinatura.
  nonTextTags: ["script", "style", "textarea", "option", "noscript", "iframe"],
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, rel: "noopener noreferrer" },
    }),
  },
};

export function sanitizeSignature(html: string): string {
  return sanitizeHtml(html, POLICY);
}

export type SignatureFinding =
  /** Etiquetas e atributos que a sanitização vai tirar. */
  | { kind: "unsafe"; detail: string }
  /** `{{coisa}}` que não é nenhuma das seis. */
  | { kind: "unknownVariable"; detail: string };

export type SignatureInspection = {
  findings: SignatureFinding[];
  /** O HTML já limpo — é este que se guarda. */
  clean: string;
  /** As variáveis reconhecidas que a assinatura usa. */
  variables: SignatureVariable[];
};

/** `{{ nome }}` e `{{nome}}` são a mesma coisa; o Postgres é que não sabe. */
const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z_]+)\s*\}\}/g;

/**
 * O que vai acontecer ao HTML, dito antes de acontecer.
 *
 * **Corre só no servidor**, e o editor pede-a a cada pausa de escrita. É a
 * mesma função que a gravação usa, e é por isso que o aviso do ecrã e o que a
 * gravação faz nunca se contradizem — um segundo detetor no cliente divergia do
 * sanitizador à primeira etiqueta nova. O custo é uma ida ao servidor por
 * pausa; a troca vale, e de resto a pré-visualização já precisava de uma (as
 * variáveis resolvem-se na base de dados, não aqui).
 */
export function inspectSignature(html: string): SignatureInspection {
  const clean = sanitizeSignature(html);
  const findings: SignatureFinding[] = [];

  for (const tag of removedTags(html, clean)) {
    findings.push({ kind: "unsafe", detail: `<${tag}>` });
  }
  for (const attribute of removedEventAttributes(html)) {
    findings.push({ kind: "unsafe", detail: attribute });
  }

  const variables = new Set<SignatureVariable>();
  const unknown = new Set<string>();
  for (const match of html.matchAll(VARIABLE_PATTERN)) {
    const name = match[1]!.toLowerCase();
    if ((SIGNATURE_VARIABLES as readonly string[]).includes(name)) {
      variables.add(name as SignatureVariable);
    } else {
      unknown.add(match[1]!);
    }
  }
  for (const name of unknown) {
    findings.push({ kind: "unknownVariable", detail: `{{${name}}}` });
  }

  return { findings, clean, variables: [...variables] };
}

/**
 * As etiquetas que estavam e deixaram de estar.
 *
 * Comparar nomes de etiqueta em vez de comparar as duas cadeias: o sanitizador
 * também normaliza aspas e fecha etiquetas abertas, e dizer "o HTML mudou"
 * sempre que ele arruma a marcação era um aviso que ninguém voltaria a ler.
 */
function removedTags(before: string, after: string): string[] {
  const names = (value: string) =>
    new Set([...value.matchAll(/<\s*([a-zA-Z][a-zA-Z0-9]*)/g)].map((m) => m[1]!.toLowerCase()));

  const kept = names(after);
  return [...names(before)].filter((tag) => !kept.has(tag));
}

/** `onclick=`, `onerror=` e companhia — o vetor mais comum de HTML colado. */
function removedEventAttributes(html: string): string[] {
  const found = new Set<string>();
  for (const match of html.matchAll(/\s(on[a-z]+)\s*=/gi)) found.add(`${match[1]!.toLowerCase()}=`);
  if (/javascript\s*:/i.test(html)) found.add("javascript:");
  return [...found];
}

export const signatureSaveSchema = z.object({
  // 200 KB é folgado para uma assinatura e estreito o suficiente para que
  // ninguém guarde uma página inteira aqui por engano.
  html: z.string().max(200_000),
});

export type SignatureSaveInput = z.infer<typeof signatureSaveSchema>;

// ---------------------------------------------------------------------------
// As três portas
//
// **Uma assinatura para toda a empresa** (29 out 2026, migração
// `20261029120000`): a tabela tem no máximo uma linha, e já não há caixas
// associadas, lista nem apagar. Gravar HTML vazio tira a assinatura dos
// e-mails — o composer trata `''` como "sem assinatura".
// ---------------------------------------------------------------------------

/** A assinatura da empresa, ou `null` antes da primeira gravação. */
export async function getCompanySignature(
  client: AnySupabaseClient,
): Promise<EmailSignatureRow | null> {
  const { data } = await client.from("email_signatures").select("*").limit(1).maybeSingle();
  return data ?? null;
}

export async function saveSignature(client: AnySupabaseClient, html: string): Promise<string> {
  const { data, error } = await client.rpc("email_signature_save", { p_html: html });

  if (error) throw new Error(error.message);
  return String(data);
}

/**
 * A pré-visualização "por utilizador" de 04 §2.6: o HTML que está no editor —
 * guardado ou não — com as variáveis do dono da caixa escolhida já resolvidas.
 * Resolvido na base de dados, porque é lá que o composer e as campanhas o
 * resolvem (05 §1.8), e um segundo `replace()` divergia à primeira variável
 * nova.
 */
export async function previewSignature(
  client: AnySupabaseClient,
  input: { html: string; mailboxId: string },
): Promise<string> {
  const { data, error } = await client.rpc("resolve_signature_variables", {
    p_html: input.html,
    p_mailbox_id: input.mailboxId,
  });

  if (error || typeof data !== "string") return "";
  return data;
}

/**
 * O logótipo da assinatura, em PNG (29 out 2026 — fecha D67)
 * =========================================================================
 * Dois PNG de 600×201, fundo transparente, rasterizados de
 * `packages/ui/src/shell/brand/logo-{light,dark}.svg`: o claro (texto navy)
 * para fundos claros, o escuro (texto quase branco) para fundos escuros.
 * Vivem em `apps/web/public/brand/` e são servidos pelo site público, porque
 * é esse o domínio que um cliente de correio consegue ir buscar. 600 px para
 * desenhar a 160: nítido num ecrã retina.
 *
 * **O claro leva um halo branco de ~2 px** (31 out 2026). Nenhum cliente de
 * correio inverte imagens, e os que pintam o e-mail de escuro sem ler CSS — a
 * app do Gmail, o Outlook clássico do Windows — mostram sempre o logótipo
 * claro. Num fundo branco o halo não se vê; num escuro, é o que deixa ler o
 * navy. É a rede de segurança por baixo da troca de `SIGNATURE_DARK_MODE_CSS`.
 *
 * Copiados também para `apps/interno/public/brand/` e `tempo/public/brand/`,
 * só para a pré-visualização: enquanto o domínio não estiver no ar, o editor
 * troca a origem pela sua (ver `signaturePreviewDocument`).
 */
export const SIGNATURE_LOGO_ORIGIN = "https://www.upropertymarket.pt";
export const SIGNATURE_LOGO_LIGHT = `${SIGNATURE_LOGO_ORIGIN}/brand/assinatura-light.png`;
export const SIGNATURE_LOGO_DARK = `${SIGNATURE_LOGO_ORIGIN}/brand/assinatura-dark.png`;

/**
 * O desenho da assinatura, como ponto de partida
 * =========================================================================
 * O desenho do cliente (29 out 2026): logótipo à esquerda, traço vertical, e à
 * direita "A Equipa UProperty Market" com telefone, e-mail e site. Substitui o
 * de 04 §2.6 (nome / cargo · departamento por pessoa): uma assinatura só para
 * a empresa, e o mesmo texto para todos.
 *
 * **Sem fundo, e o texto herda a cor do contexto.** O corpo do e-mail de quem
 * recebe tanto pode ser claro como escuro; as únicas cores escritas são
 * cinzentos médios (rótulos e traço), que se leem nos dois. Os links levam
 * `color: inherit` para não saírem no azul por omissão — nem num navy que
 * desaparecia num fundo escuro.
 *
 * **Os dois logótipos vão no HTML** (31 out 2026). O escuro está escondido em
 * linha — `display: none` para todos, `mso-hide: all` para o Outlook do
 * Windows, que ignora o primeiro — e só aparece quando a folha de
 * `SIGNATURE_DARK_MODE_CSS` o mostra. Quem não lê essa folha fica com o claro,
 * que tem o halo para aguentar um fundo escuro.
 */
export const SIGNATURE_TEMPLATE = `<table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6;">
  <tr>
    <td style="padding-right: 24px; border-right: 1px solid #D4D4D4; vertical-align: middle;">
      <img class="upm-sig-logo-light" src="${SIGNATURE_LOGO_LIGHT}" alt="UProperty Market" width="160" height="54" style="display: block; border: 0;">
      <div class="upm-sig-logo-dark" style="display: none; mso-hide: all; max-height: 0; overflow: hidden;">
        <img src="${SIGNATURE_LOGO_DARK}" alt="UProperty Market" width="160" height="54" style="display: block; border: 0;">
      </div>
    </td>
    <td style="padding-left: 24px; vertical-align: middle;">
      <p style="margin: 0 0 12px 0; font-weight: 600; font-size: 15px;">A Equipa UProperty Market</p>
      <table cellpadding="0" cellspacing="0" border="0" style="line-height: 1.6;">
        <tr>
          <td style="padding-bottom: 4px; color: #8A8A8A; font-size: 13px;">Tel:</td>
          <td style="padding-bottom: 4px; padding-left: 8px;">(+351) 939 732 637</td>
        </tr>
        <tr>
          <td style="padding-bottom: 4px; color: #8A8A8A; font-size: 13px;">Email:</td>
          <td style="padding-bottom: 4px; padding-left: 8px;"><a href="mailto:info@upropertymarket.pt" style="color: inherit; text-decoration: none;">info@upropertymarket.pt</a></td>
        </tr>
        <tr>
          <td style="color: #8A8A8A; font-size: 13px;">Web:</td>
          <td style="padding-left: 8px;"><a href="https://www.upropertymarket.pt" style="color: inherit; text-decoration: none;">www.upropertymarket.pt</a></td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

/**
 * O logótipo servido pela origem de quem o mostra
 * =========================================================================
 * A assinatura aponta para o site público, que é o que um cliente de correio
 * consegue ir buscar. Dentro das nossas apps — o editor, o composer, o canvas —
 * a mesma imagem vem da origem de quem a mostra, que serve o mesmo PNG em
 * `/brand/`: assim vê-se o logótipo antes de o domínio estar no ar, e sem
 * depender dele depois.
 */
export function withLogoOrigin(html: string, origin?: string): string {
  return origin ? html.split(`${SIGNATURE_LOGO_ORIGIN}/brand/`).join(`${origin}/brand/`) : html;
}

/** As cores da janela de pré-visualização, por tema. Literais: no `iframe` não há tokens. */
const PREVIEW_COLORS = {
  light: {
    page: "#F1F5F9",
    window: "#FFFFFF",
    bar: "#F8FAFC",
    line: "#E2E8F0",
    text: "#0F172A",
    muted: "#64748B",
  },
  dark: {
    page: "#0B1120",
    window: "#0F172A",
    bar: "#1E293B",
    line: "#334155",
    text: "#F8FAFC",
    muted: "#94A3B8",
  },
} as const;

/**
 * O documento do `iframe` da pré-visualização: um composer simples
 * =========================================================================
 * A assinatura não tem fundo nem cor de texto — herda-os do e-mail. Por isso
 * mostra-se onde vai viver (1 nov 2026): uma janela de "Novo e-mail" básica,
 * com Para, Assunto, o corpo vazio e a assinatura por baixo do traço. Não é o
 * `Composer` verdadeiro — é só a moldura que dá contexto ao que se edita.
 *
 * No escuro aplicam-se as regras de `SIGNATURE_DARK_MODE_CSS` sem a media
 * query — o tema escolhido no editor não é o do sistema —, e por isso o que se
 * vê é o que o Apple Mail ou o Outlook.com mostram em escuro.
 */
export function signaturePreviewDocument(
  html: string,
  theme: "light" | "dark",
  origin?: string,
): string {
  const c = PREVIEW_COLORS[theme];
  const style = `<style>
body { margin: 0; padding: 16px; background: ${c.page}; color: ${c.text}; font-family: Arial, Helvetica, sans-serif; }
.w { background: ${c.window}; border: 1px solid ${c.line}; border-radius: 10px; overflow: hidden; }
.bar { padding: 10px 16px; background: ${c.bar}; border-bottom: 1px solid ${c.line}; font-size: 14px; font-weight: 600; }
.row { display: flex; align-items: center; gap: 12px; padding: 8px 16px; border-bottom: 1px solid ${c.line}; font-size: 13px; }
.row span:first-child { min-width: 52px; color: ${c.muted}; }
.row .cc { margin-left: auto; color: ${c.muted}; }
.body { padding: 16px; }
.gap { height: 48px; }
hr { border: 0; border-top: 1px solid ${c.line}; margin: 0 0 16px; }
${theme === "dark" ? DARK_RULES("body") : ""}
</style>`;
  return `<!doctype html><html style="color-scheme: ${theme};"><head>${style}</head><body><div class="w"><div class="bar">Novo e-mail</div><div class="row"><span>Para</span><span>destinatario@exemplo.pt</span><span class="cc">Cc&nbsp;&nbsp;Bcc</span></div><div class="row"><span>Assunto</span><span>Assunto da mensagem</span></div><div class="body"><div class="gap"></div><hr>${withLogoOrigin(html, origin)}</div></div></body></html>`;
}
