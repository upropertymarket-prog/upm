import sanitizeHtml from "sanitize-html";
import { z } from "zod";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "./database.types";
import { nullableArg } from "./rpc-args";

/**
 * Atualizações — as novidades das apps (P10-07 · 04 §2.6 e §8.1.3)
 * =========================================================================
 * A primeira tarefa da área `/marketing`, e a que a faz nascer (07 §24.6). O
 * corte que a põe aqui e não no Suporte é o critério da própria decisão: **o
 * Suporte responde a uma pessoa que pediu ajuda; o Marketing fala com um
 * público.** Uma novidade de produto é 1:N e proativa.
 *
 * ## O corpo é HTML sanitizado na escrita, como as assinaturas
 *
 * Mesma razão de `signatures.ts` e mesma biblioteca (02 §4.3): o corpo é
 * escrito num editor rico e **mostrado num modal dentro da app autenticada**,
 * onde há sessão de um cliente aberta. A lista do que passa é maior do que a
 * das assinaturas porque aqui o texto é prosa a sério — títulos, listas,
 * ligações, imagens — e não um bloco de contacto de seis linhas.
 *
 * O que **não** passa é o mesmo, e pela mesma razão: `<script>`, `<style>`
 * (que vazaria para a app inteira), `<iframe>`, `<form>` e qualquer `on…=`.
 */

type AnySupabaseClient = SupabaseClient<Database>;

/** Do ficheiro gerado desde 21 out 2026 (D64): era um tipo à mão em `pending-types.ts`. */
export type AppUpdateRow = Tables<"app_updates">;

export const APP_UPDATE_STATUSES = ["draft", "scheduled", "published", "archived"] as const;
export type AppUpdateStatus = (typeof APP_UPDATE_STATUSES)[number];

export const APP_UPDATE_AUDIENCES = ["all", "owners", "buyers"] as const;
export type AppUpdateAudience = (typeof APP_UPDATE_AUDIENCES)[number];

/**
 * As três entregas de 04 §2.6, e a diferença entre elas é só **quando
 * interrompem**:
 *
 * - `banner` — faixa no topo agora; o modal só no próximo login.
 * - `next_login` — nada agora; modal no próximo login.
 * - `mandatory` — modal imediato, e sem "Mais tarde": é para o que não pode
 *   passar ao lado de ninguém (uma alteração de preço, um fim de serviço).
 */
export const APP_UPDATE_DELIVERIES = ["banner", "next_login", "mandatory"] as const;
export type AppUpdateDelivery = (typeof APP_UPDATE_DELIVERIES)[number];

/** Os tons de 04 §5.6, da família genérica de ciclo de vida. */
export const APP_UPDATE_STATUS_TONES: Record<AppUpdateStatus, string> = {
  draft: "draft",
  scheduled: "pending",
  published: "active",
  archived: "archived",
};

// ---------------------------------------------------------------------------
// Sanitização do corpo
// ---------------------------------------------------------------------------

const POLICY: sanitizeHtml.IOptions = {
  allowedTags: [
    "a",
    "b",
    "blockquote",
    "br",
    "code",
    "em",
    "h2",
    "h3",
    "hr",
    "i",
    "img",
    "li",
    "ol",
    "p",
    "pre",
    "strong",
    "u",
    "ul",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "width", "height"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesAppliedToAttributes: ["href", "src"],
  allowProtocolRelative: false,
  // Sem isto, o **conteúdo** de um `<script>` ficaria como texto visível.
  nonTextTags: ["script", "style", "textarea", "option", "noscript", "iframe"],
  transformTags: {
    // Uma ligação numa novidade aponta quase sempre para fora da app (um artigo,
    // uma página de preços). Abre noutro separador e sem passar o referrer.
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" },
    }),
  },
};

export function sanitizeUpdateBody(html: string): string {
  return sanitizeHtml(html, POLICY);
}

/**
 * `h1` não entra na lista, e é de propósito: o título da novidade já é o `h1`
 * do modal, e um segundo partia a hierarquia de cabeçalhos que os leitores de
 * ecrã seguem (04 §1.7). Quem colar um `h1` fica com o texto, sem a etiqueta.
 */
export function updateBodyFindings(html: string): string[] {
  const clean = sanitizeUpdateBody(html);
  const names = (value: string) =>
    new Set([...value.matchAll(/<\s*([a-zA-Z][a-zA-Z0-9]*)/g)].map((m) => m[1]!.toLowerCase()));

  const kept = names(clean);
  const removed = [...names(html)].filter((tag) => !kept.has(tag)).map((tag) => `<${tag}>`);

  for (const match of html.matchAll(/\s(on[a-z]+)\s*=/gi))
    removed.push(`${match[1]!.toLowerCase()}=`);
  if (/javascript\s*:/i.test(html)) removed.push("javascript:");

  return [...new Set(removed)];
}

// ---------------------------------------------------------------------------
// Escrita — uma função por porta, com o nome do RPC que chama
// ---------------------------------------------------------------------------

export const appUpdateSaveSchema = z.object({
  id: z.string().uuid().nullish(),
  version: z.string().trim().max(40).default(""),
  title: z.string().trim().min(1, "A atualização precisa de um título.").max(160),
  bodyHtml: z.string().max(100_000).default(""),
  points: z.array(z.string().trim().min(1).max(200)).max(12).default([]),
  imagePath: z.string().max(500).nullish(),
  imageAlt: z.string().trim().max(200).default(""),
  audience: z.enum(APP_UPDATE_AUDIENCES).default("all"),
  delivery: z.enum(APP_UPDATE_DELIVERIES).default("next_login"),
  /** ISO, ou `null` para devolver ao rascunho. */
  scheduledFor: z.string().datetime({ offset: true }).nullish(),
});

export type AppUpdateSaveInput = z.infer<typeof appUpdateSaveSchema>;

export async function listAppUpdates(client: AnySupabaseClient): Promise<AppUpdateRow[]> {
  const { data } = await client
    .from("app_updates")
    .select("*")
    .order("created_at", { ascending: false });

  return data ?? [];
}

/**
 * O alcance de cada atualização — "lista (… + alcance)" de 04 §2.6.
 *
 * Uma contagem por `update_id`, e não o `count` de uma subconsulta por linha:
 * são meia dúzia de novidades e uma leitura só.
 */
export async function appUpdateReach(client: AnySupabaseClient): Promise<Record<string, number>> {
  const { data, error } = await client.rpc("app_update_reach");
  if (error || !Array.isArray(data)) return {};

  const reach: Record<string, number> = {};
  for (const row of data) reach[row.update_id] = row.seen;
  return reach;
}

export async function saveAppUpdate(
  client: AnySupabaseClient,
  input: AppUpdateSaveInput & { bodyHtml: string },
): Promise<string> {
  const { data, error } = await client.rpc("app_update_save", {
    p_id: nullableArg(input.id),
    p_version: input.version,
    p_title: input.title,
    p_body_html: input.bodyHtml,
    p_points: input.points,
    p_image_path: nullableArg(input.imagePath),
    p_image_alt: input.imageAlt,
    p_audience: input.audience,
    p_delivery: input.delivery,
    p_scheduled_for: nullableArg(input.scheduledFor),
  });

  if (error) throw new Error(error.message);
  return String(data);
}

export async function publishAppUpdate(client: AnySupabaseClient, id: string): Promise<void> {
  const { error } = await client.rpc("app_update_publish", { p_id: id });
  if (error) throw new Error(error.message);
}

export async function archiveAppUpdate(client: AnySupabaseClient, id: string): Promise<void> {
  const { error } = await client.rpc("app_update_archive", { p_id: id });
  if (error) throw new Error(error.message);
}

export async function deleteAppUpdate(client: AnySupabaseClient, id: string): Promise<void> {
  const { error } = await client.rpc("app_update_delete", { p_id: id });
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Leitura do lado da app — o que esta pessoa ainda não viu
// ---------------------------------------------------------------------------

/** O que o modal de 04 §8.1.3 mostra, por novidade. */
export type AppUpdateForMe = {
  id: string;
  version: string;
  title: string;
  bodyHtml: string;
  points: string[];
  imagePath: string | null;
  imageAlt: string;
  delivery: AppUpdateDelivery;
};

/**
 * As novidades publicadas, do público de quem pergunta e ainda não vistas.
 *
 * **A audiência resolve-se no servidor** e a app nunca recebe o que não lhe diz
 * respeito — a mesma regra das audiências de campanha (07 §24.6 #5). Por
 * omissão devolve `[]`: um erro de leitura não pode fazer o modal abrir vazio
 * nem a faixa aparecer sem conteúdo.
 */
export async function appUpdatesForMe(client: AnySupabaseClient): Promise<AppUpdateForMe[]> {
  const { data, error } = await client.rpc("app_updates_for_me");
  if (error || !Array.isArray(data)) return [];

  return data.map((row) => ({
    id: row.id,
    version: row.version,
    title: row.title,
    bodyHtml: row.body_html,
    points: row.points ?? [],
    imagePath: row.image_path,
    imageAlt: row.image_alt,
    delivery: row.delivery,
  }));
}

export async function markAppUpdateSeen(client: AnySupabaseClient, id: string): Promise<void> {
  const { error } = await client.rpc("mark_app_update_seen", { p_update_id: id });
  if (error) throw new Error(error.message);
}
