import type { SupabaseClient } from "@supabase/supabase-js";
import { INTL_LOCALE, resolveLocale } from "@upm/config";
import type { Database } from "@upm/db";
import { parseAttachments } from "@upm/db/interaction";
import type { Notification } from "@upm/ui";

import {
  initialsOf,
  type ConversationDetail,
  type ConversationSummary,
  type LeadRow,
  type VisitRow,
} from "../components/interaction/interactionTypes";
import { formatRelative } from "../components/interaction/interactionTypes";

/**
 * Leituras da Fase 5, do lado do servidor
 * =========================================================================
 * As listas vêm das funções `my_conversations`, `my_visit_requests` e
 * `my_owner_leads` (migração `20260929120200_interaction_reads.sql`), e não de
 * `select` com joins: a RLS de `profiles` e de `properties` (02 §7.1) impede
 * um comprador de ler o nome do proprietário ou o título do imóvel, e alargá-la
 * daria muito mais do que uma lista de conversas precisa.
 *
 * Tudo aqui devolve os modelos de vista de `interactionTypes.ts` — as páginas
 * passam-nos por prop, os componentes não sabem que o Supabase existe.
 */

type Client = SupabaseClient<Database>;

export async function loadConversations(supabase: Client): Promise<ConversationSummary[]> {
  const { data } = await supabase.rpc("my_conversations");
  return (data ?? []).map((row) => ({
    id: row.id,
    propertyId: row.property_id,
    propertyTitle: row.property_title ?? "Imóvel",
    propertyLocation: row.property_location ?? "",
    other: {
      id: row.other_id,
      name: row.other_name ?? "Utilizador",
      initials: initialsOf(row.other_name ?? "Utilizador"),
    },
    lastMessage: row.last_message ?? "",
    lastMessageAt: row.last_message_at,
    unread: row.unread ?? 0,
  }));
}

/**
 * A conversa aberta, com as mensagens. `messages` vem por `select` direto: a
 * RLS de `messages` já resolve o acesso (só participantes) e não há nada de
 * outra tabela a juntar.
 */
export async function loadConversationDetail(
  supabase: Client,
  userId: string,
  conversationId: string,
  summaries: ConversationSummary[],
): Promise<ConversationDetail | null> {
  const summary = summaries.find((item) => item.id === conversationId);
  if (!summary) return null;

  const [{ data: messages }, { data: rows }] = await Promise.all([
    supabase
      .from("messages")
      .select("id, body, created_at, sender_id, read_at, attachments")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true }),
    supabase.rpc("my_conversations"),
  ]);

  const meta = (rows ?? []).find((row) => row.id === conversationId);

  return {
    ...summary,
    messages: (messages ?? []).map((message) => ({
      id: message.id,
      body: message.body,
      createdAt: message.created_at,
      mine: message.sender_id === userId,
      read: message.read_at !== null,
      attachments: parseAttachments(message.attachments),
    })),
    canShareAddress: meta?.is_owner ?? false,
    addressShared: meta?.address_shared ?? false,
    buyerId: meta?.buyer_id ?? "",
  };
}

export async function loadVisits(supabase: Client): Promise<VisitRow[]> {
  const { data } = await supabase.rpc("my_visit_requests");
  return (data ?? []).map((row) => ({
    id: row.id,
    propertyId: row.property_id,
    propertyTitle: row.property_title ?? "Imóvel",
    propertyLocation: row.property_location ?? "",
    other: {
      id: row.other_id,
      name: row.other_name ?? "Utilizador",
      initials: initialsOf(row.other_name ?? "Utilizador"),
    },
    proposedAt: row.proposed_at,
    message: row.message ?? "",
    status: row.status,
    rescheduleCount: row.reschedule_count ?? 0,
    proposedByMe: row.proposed_by_me ?? false,
  }));
}

export async function loadLeads(supabase: Client): Promise<LeadRow[]> {
  const { data } = await supabase.rpc("my_owner_leads");
  return (data ?? []).map((row) => ({
    id: row.id,
    propertyId: row.property_id,
    propertyTitle: row.property_title ?? "Imóvel",
    propertyLocation: row.property_location ?? "",
    contact: {
      id: row.contact_id,
      name: row.contact_name ?? "Utilizador",
      initials: initialsOf(row.contact_name ?? "Utilizador"),
    },
    stage: row.stage,
    outcome: row.outcome,
    lastMessage: row.last_message ?? "",
    lastActivityAt: row.last_activity_at,
    conversationId: row.conversation_id,
  }));
}

export type DashboardCounts = {
  newLeads: number;
  visitsAccepted: number;
  visitsAwaiting: number;
  conversationsUnread: number;
};

/**
 * Os números do Painel, contados na base (3 nov 2026)
 * =========================================================================
 * Contavam-se em JS sobre as listas — e o PostgREST corta qualquer resposta
 * às 1000 linhas, sem aviso. Um proprietário com 1200 leads via "1000", e o
 * número parecia certo. Aqui o filtro e a contagem vão para o PostgREST
 * (`count: "exact"` sobre o resultado da função), que conta tudo e só devolve
 * uma linha.
 */
export async function loadDashboardCounts(supabase: Client): Promise<DashboardCounts> {
  const contar = async (pedido: PromiseLike<{ count: number | null }>) => (await pedido).count ?? 0;
  const [newLeads, visitsAccepted, visitsAwaiting, conversationsUnread] = await Promise.all([
    contar(
      supabase
        .rpc("my_owner_leads", undefined, { count: "exact" })
        .in("stage", ["new", "contacted"])
        .limit(1),
    ),
    contar(
      supabase
        .rpc("my_visit_requests", undefined, { count: "exact" })
        .eq("status", "accepted")
        .limit(1),
    ),
    contar(
      supabase
        .rpc("my_visit_requests", undefined, { count: "exact" })
        .in("status", ["pending", "rescheduled"])
        .limit(1),
    ),
    contar(
      supabase.rpc("my_conversations", undefined, { count: "exact" }).gt("unread", 0).limit(1),
    ),
  ]);
  return { newLeads, visitsAccepted, visitsAwaiting, conversationsUnread };
}

/**
 * O sino da topbar (04 §5.5). Traz as últimas; o contador vem das não lidas.
 *
 * O `locale` entra por parâmetro porque o "há 2 horas" de cada linha é texto
 * que alguém lê: esta função corre no servidor, onde não há hook, e o idioma
 * é o da página que a chama. Recebe a etiqueta curta (`pt`/`en`) e resolve a
 * do `Intl` aqui, para quem chama não ter de saber dessa distinção.
 */
export async function loadNotifications(supabase: Client, locale: string): Promise<Notification[]> {
  const { data } = await supabase
    .from("notifications")
    .select("id, title, body, link, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(12);

  return (data ?? []).map((row) => ({
    id: row.id,
    text: row.body ? `${row.title} — ${row.body}` : row.title,
    when: formatRelative(row.created_at, INTL_LOCALE[resolveLocale(locale)]),
    read: row.read_at !== null,
    href: row.link ?? undefined,
  }));
}

/**
 * Contadores da sidebar (07 §4.2/§4.3), contados na base (F4, 3 nov 2026)
 * =========================================================================
 * Mensagens por ler, visitas que esperam resposta minha (um pedido pendente,
 * ou uma data proposta pelo outro lado — o que eu propus está à espera dele)
 * e leads ainda por contactar.
 *
 * Até aqui contavam-se em JS sobre as listas inteiras, carregadas em cada uma
 * das 11 páginas só para isto — e acima das 1000 linhas o número saía errado.
 * `my_nav_counters()` conta a partir das mesmas funções de onde as listas vêm,
 * com as mesmas regras: uma definição só. Ver a migração `20261103110000`.
 *
 * Falha para zeros: um número do menu que não se conseguiu ler não pode
 * impedir a página de abrir.
 */
export async function loadNavCounters(
  supabase: Client,
  role: "owner" | "buyer",
): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc("my_nav_counters");
  const contadores = (!error && data && typeof data === "object" ? data : {}) as Record<
    string,
    unknown
  >;
  const numero = (chave: string) => (typeof contadores[chave] === "number" ? contadores[chave] : 0);

  return role === "owner"
    ? { messages: numero("messages"), visitSchedule: numero("waiting"), leads: numero("leads") }
    : { messages: numero("messages"), myRequests: numero("waiting") };
}
