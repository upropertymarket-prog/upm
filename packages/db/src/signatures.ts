import sanitizeHtml from "sanitize-html";
import { z } from "zod";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "./database.types";
import { nullableArg } from "./rpc-args";

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
  id: z.string().uuid().nullish(),
  name: z.string().trim().min(1, "A assinatura precisa de um nome.").max(80),
  // 200 KB é folgado para uma assinatura e estreito o suficiente para que
  // ninguém guarde uma página inteira aqui por engano.
  html: z.string().max(200_000),
  mailboxIds: z.array(z.string().uuid()).max(20).default([]),
});

export type SignatureSaveInput = z.infer<typeof signatureSaveSchema>;

// ---------------------------------------------------------------------------
// As quatro portas
// ---------------------------------------------------------------------------

export async function listSignatures(client: AnySupabaseClient): Promise<EmailSignatureRow[]> {
  const { data } = await client
    .from("email_signatures")
    .select("*")
    .order("created_at", { ascending: true });

  return data ?? [];
}

/** Devolve o `id` — o editor continua a gravar por cima da linha que nasceu. */
export async function saveSignature(
  client: AnySupabaseClient,
  input: SignatureSaveInput & { html: string },
): Promise<string> {
  const { data, error } = await client.rpc("email_signature_save", {
    p_id: nullableArg(input.id),
    p_name: input.name,
    p_html: input.html,
    p_mailbox_ids: input.mailboxIds,
  });

  if (error) throw new Error(error.message);
  return String(data);
}

export async function deleteSignature(client: AnySupabaseClient, id: string): Promise<void> {
  const { error } = await client.rpc("email_signature_delete", { p_id: id });
  if (error) throw new Error(error.message);
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
 * O desenho de 04 §2.6, como ponto de partida
 * =========================================================================
 * Existe para que a primeira assinatura não comece numa caixa vazia — é o que
 * transforma "escreva HTML" em "mude o que está aqui". Segue o que o doc
 * descreve: marca alinhada ao topo, traço vertical neutro à esquerda do texto,
 * nome / cargo·departamento / e-mail / telefone / slogan.
 *
 * **Sem fundo e com cores explícitas**, e as duas coisas são deliberadas: a
 * assinatura herda o fundo do contexto (o corpo do e-mail de quem recebe, que
 * tanto pode ser claro como escuro) mas **não pode herdar a cor do texto** —
 * um cliente de correio sem a nossa folha de estilos não tem tokens. É a
 * segunda exceção viva à regra de 04 §5.1, ao lado da folha do iframe do
 * leitor, e pela mesma razão: o que sai num e-mail não está na nossa app.
 *
 * ## A marca vai em texto, e não como imagem (D67)
 *
 * 04 §2.6 pede o "logo completo alinhado ao topo", e ele **não pode entrar
 * aqui hoje** por duas razões somadas:
 *
 * 1. **Os logótipos do projeto são SVG** (`packages/ui/src/shell/brand/`), e o
 *    Gmail, o Outlook e o Apple Mail não desenham SVG dentro de um e-mail.
 *    Precisa de um PNG, que é um ativo que ninguém exportou — e exportá-lo é
 *    uma decisão de desenho (tamanho, margem, versão clara/escura), não um
 *    comando.
 * 2. **Precisa de um URL absoluto e público.** O domínio não serve nada ainda,
 *    e um `src` para um caminho que não existe dá um retângulo partido na
 *    assinatura de toda a equipa.
 *
 * Por isso a marca vai como texto, com o laranja do acento: é o que se lê bem
 * em qualquer cliente e **não finge** ter uma imagem. Está registado como
 * **D67** no doc 10 — e é deliberadamente a mesma decisão de D63, onde nenhum
 * `seo.ts` aponta para uma imagem Open Graph inventada.
 */
export const SIGNATURE_TEMPLATE = `<table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.5;">
  <tr>
    <td style="padding-right: 14px; vertical-align: top;">
      <div style="font-weight: 800; font-size: 15px; color: #EA580C; white-space: nowrap;">UProperty Market</div>
    </td>
    <td style="padding-left: 14px; border-left: 2px solid #CBD5E1; vertical-align: top;">
      <div style="font-weight: 700; color: #0F172A;">{{nome}}</div>
      <div style="color: #64748B;">{{cargo}} · {{departamento}}</div>
      <div style="padding-top: 6px;">
        <a href="mailto:{{email}}" style="color: #EA580C; text-decoration: none;">{{email}}</a>
      </div>
      <div style="color: #64748B;">{{telefone}}</div>
      <div style="padding-top: 6px; color: #64748B; font-size: 12px;">Imóveis sem comissões.</div>
    </td>
  </tr>
</table>`;
