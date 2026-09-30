import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@upm/db";
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
      .select("id, body, created_at, sender_id, read_at")
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

/** O sino da topbar (04 §5.5). Traz as últimas; o contador vem das não lidas. */
export async function loadNotifications(supabase: Client): Promise<Notification[]> {
  const { data } = await supabase
    .from("notifications")
    .select("id, title, body, link, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(12);

  return (data ?? []).map((row) => ({
    id: row.id,
    text: row.body ? `${row.title} — ${row.body}` : row.title,
    when: formatRelative(row.created_at),
    read: row.read_at !== null,
    href: row.link ?? undefined,
  }));
}

/**
 * Contadores da sidebar (07 §4.2/§4.3): Mensagens por ler, visitas à espera de
 * resposta e leads ainda por contactar. Calculados a partir das mesmas listas
 * para não haver duas definições do mesmo número.
 */
export function countersFor(
  role: "owner" | "buyer",
  conversations: ConversationSummary[],
  visits: VisitRow[],
  leads: LeadRow[],
): Record<string, number> {
  const messages = conversations.reduce((total, item) => total + item.unread, 0);
  // O que exige resposta minha: um pedido pendente, ou uma data proposta pelo
  // outro lado. O que eu próprio propus não conta — está à espera dele.
  const waiting = visits.filter(
    (visit) =>
      (visit.status === "pending" || visit.status === "rescheduled") && !visit.proposedByMe,
  ).length;

  return role === "owner"
    ? {
        messages,
        visitSchedule: waiting,
        leads: leads.filter((lead) => lead.stage === "new" || lead.stage === "contacted").length,
      }
    : { messages, myRequests: waiting };
}
