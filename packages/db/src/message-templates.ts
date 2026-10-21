import sanitizeHtml from "sanitize-html";
import { z } from "zod";

import type { SupabaseClient } from "@supabase/supabase-js";
import { Constants, type Database, type Tables } from "./database.types";
import { nullableArg } from "./rpc-args";

/**
 * Modelos de e-mail — o texto aprovado que toda a equipa usa (21 out 2026)
 * =========================================================================
 * Decisão do cliente: **o Marketing escreve, toda a equipa usa.** Até aqui,
 * cada pessoa redigia do zero a resposta a uma lead, a um proprietário ou a um
 * comprador, e o que saía pela mesma caixa dizia a mesma coisa de dez maneiras.
 *
 * Irmão de `updates.ts` e de `signatures.ts` — mesma forma, papéis diferentes:
 *
 * - uma **assinatura** é de uma caixa e entra sozinha em tudo o que sai dela;
 * - uma **novidade** é 1:N e proativa, e vai para dentro da app;
 * - um **modelo** é de um assunto, escolhe-se, e sai num e-mail para uma
 *   pessoa.
 *
 * ## Só e-mail, por decisão explícita
 *
 * A referência que deu a ideia tinha WhatsApp e SMS. Não existem no produto, e
 * um seletor de canal com uma opção é um seletor que mente. Entra quando o
 * canal entrar.
 *
 * ## O corpo é sanitizado na escrita, como as novidades
 *
 * Mesma biblioteca e mesma razão (02 §4.3): é HTML de um editor rico, e vai
 * ser desenhado duas vezes — na pré-visualização do Marketing e no compositor
 * de quem o insere, ambos **dentro do painel interno**. A lista do que passa é
 * a das novidades, porque aqui também é prosa a sério.
 *
 * ## As variáveis não se resolvem aqui, e é deliberado
 *
 * O modelo guarda `{{nome}}` como texto. Quem o insere no compositor é que tem
 * o contexto — a que pessoa está a escrever, sobre que imóvel — e esse contexto
 * não existe no momento em que o modelo se grava. As assinaturas resolvem no
 * servidor (`resolve_signature_variables`) porque o que lá entra é sempre a
 * caixa e quem a tem; aqui não há equivalente.
 *
 * O que isto significa na prática: o compositor insere o texto com as chaves à
 * vista, e quem escreve substitui-as. É honesto e é o que a referência faz.
 */

type AnySupabaseClient = SupabaseClient<Database>;

export type MessageTemplateRow = Tables<"message_templates">;

/**
 * As categorias, do enum gerado — e não de uma lista à mão.
 *
 * É a lição que quatro listas desatualizadas desta sessão deixaram: a única
 * lista de valores de enum que não envelhece é a que o Postgres escreve.
 */
export const TEMPLATE_CATEGORIES = Constants.public.Enums.message_template_category;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

/**
 * As variáveis que um modelo pode conter, **adaptadas ao nosso produto** por
 * decisão do cliente.
 *
 * Três origens, e a origem é o que diz a quem pergunta "isto é preenchido por
 * quem?":
 *
 * - **destinatário** — a pessoa a quem se escreve;
 * - **imóvel** — quando o e-mail é sobre um, que é o caso mais comum;
 * - **operador** — quem assina, e que o compositor já sabe.
 *
 * O vocabulário do imóvel vem do namespace `property`, que já é lido pelos dois
 * lados do produto (a app e a moderação do Admin) — reaproveitar antes de
 * inventar é regra do projeto e aqui aplica-se à letra.
 */
export const TEMPLATE_VARIABLES = [
  { key: "nome", group: "recipient" },
  { key: "email", group: "recipient" },
  { key: "imovel", group: "property" },
  { key: "imovel_preco", group: "property" },
  { key: "imovel_localidade", group: "property" },
  { key: "operador", group: "operator" },
  { key: "operador_cargo", group: "operator" },
] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number]["key"];
export type TemplateVariableGroup = (typeof TEMPLATE_VARIABLES)[number]["group"];

/** Os grupos pela ordem em que o menu os mostra. */
export const TEMPLATE_VARIABLE_GROUPS = ["recipient", "property", "operator"] as const;

// ---------------------------------------------------------------------------
// Sanitização — a mesma política das novidades
// ---------------------------------------------------------------------------

const POLICY: sanitizeHtml.IOptions = {
  allowedTags: [
    "a",
    "b",
    "blockquote",
    "br",
    "em",
    "h2",
    "h3",
    "i",
    "li",
    "ol",
    "p",
    "span",
    "strong",
    "u",
    "ul",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    // O chip da variável, igual ao das campanhas: é o contrato entre o editor
    // e quem lê o modelo. Sem o `data-variable`, um `<span>` sanitizado perdia
    // a variável e ficava texto solto.
    span: ["data-variable", "data-label", "class"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesAppliedToAttributes: ["href"],
  allowProtocolRelative: false,
  // Sem isto o **conteúdo** de um `<script>` ficava como texto visível.
  nonTextTags: ["script", "style", "textarea", "option", "noscript", "iframe"],
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" },
    }),
  },
};

export function sanitizeTemplateHtml(html: string): string {
  return sanitizeHtml(html, POLICY);
}

/** O que a sanitização retirou, para o ecrã o poder dizer. */
export function templateFindings(html: string): string[] {
  const removed: string[] = [];
  const clean = sanitizeTemplateHtml(html);
  const names = (value: string) =>
    new Set([...value.matchAll(/<\s*([a-zA-Z][a-zA-Z0-9]*)/g)].map((m) => m[1]!.toLowerCase()));

  const kept = names(clean);
  for (const tag of names(html)) if (!kept.has(tag)) removed.push(`<${tag}>`);
  for (const match of html.matchAll(/\s(on[a-z]+)\s*=/gi))
    removed.push(`${match[1]!.toLowerCase()}=`);
  if (/javascript\s*:/i.test(html)) removed.push("javascript:");

  return [...new Set(removed)];
}

/**
 * Um excerto em texto simples, para o cartão da lista.
 *
 * O cartão mostra o princípio do corpo, e o corpo é HTML: injetá-lo no cartão
 * dava marcação a competir com o desenho da lista. Tira-se a marcação e
 * colapsa-se o espaço — é o mesmo que a lista de e-mail já faz com o
 * `text_body`.
 */
export function templatePreview(html: string, max = 180): string {
  const text = html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|h2|h3|li)>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

/** Todos, ativos e inativos — é a lista do Marketing. */
export async function listTemplates(client: AnySupabaseClient): Promise<MessageTemplateRow[]> {
  const { data } = await client
    .from("message_templates")
    .select("*")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  return data ?? [];
}

/**
 * Só os ativos — é o que o compositor oferece.
 *
 * Um modelo inativo continua a existir e a ver-se no Marketing; o que ele
 * perde é aparecer na lista de quem está a escrever um e-mail. É essa a
 * diferença entre inativar e apagar.
 */
export async function listActiveTemplates(
  client: AnySupabaseClient,
): Promise<MessageTemplateRow[]> {
  const { data } = await client
    .from("message_templates")
    .select("*")
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  return data ?? [];
}

// ---------------------------------------------------------------------------
// Escrita — uma função por porta, com o nome do RPC que chama
// ---------------------------------------------------------------------------

export const templateSaveSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "O nome do modelo é obrigatório.").max(120),
  category: z.enum(TEMPLATE_CATEGORIES),
  subject: z.string().trim().max(300),
  bodyHtml: z.string().max(60_000),
  isActive: z.boolean().optional(),
});

export type TemplateSaveInput = z.infer<typeof templateSaveSchema>;

export async function saveTemplate(
  client: AnySupabaseClient,
  input: TemplateSaveInput & { bodyHtml: string },
): Promise<string> {
  const { data, error } = await client.rpc("template_save", {
    p_id: nullableArg(input.id),
    p_name: input.name,
    p_category: input.category,
    p_subject: input.subject,
    p_body_html: input.bodyHtml,
    p_is_active: input.isActive ?? true,
  });

  if (error) throw new Error(error.message);
  return String(data);
}

export async function deleteTemplate(client: AnySupabaseClient, id: string): Promise<void> {
  const { error } = await client.rpc("template_delete", { p_id: id });
  if (error) throw new Error(error.message);
}
