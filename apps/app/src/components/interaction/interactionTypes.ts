import type { LeadOutcome, LeadStage, VisitStatus } from "@upm/db/interaction";

/**
 * Modelos de vista da Fase 5 (P5-01 a P5-04)
 * =========================================================================
 * O mesmo contrato do `PropertyListing` da Fase 4: a página (Server Component)
 * faz as queries e passa isto pronto; os componentes de ecrã não falam com o
 * Supabase. É o que permite montar o mesmo ecrã numa storyboard com dados
 * fixos — e um componente que importa uma Server Action diretamente parte o
 * canvas (08 §9, adenda da Fase 4).
 *
 * Datas viajam como ISO e são formatadas no componente: uma `Date` atravessa
 * a fronteira servidor→cliente do Next como string à mesma, e formatar no
 * servidor amarrava o texto ao fuso da máquina que renderizou.
 */

export type Participant = {
  id: string;
  name: string;
  initials: string;
};

// ---------------------------------------------------------------------------
// Mensagens — 04 §8.3 "Mensagens"
// ---------------------------------------------------------------------------

export type ChatMessage = {
  id: string;
  body: string;
  /** ISO. */
  createdAt: string;
  /** `true` quando fui eu que escrevi — decide o lado e a cor da bolha. */
  mine: boolean;
  read: boolean;
};

export type ConversationSummary = {
  id: string;
  propertyId: string;
  propertyTitle: string;
  propertyLocation: string;
  /** O outro lado da conversa, seja ele comprador ou proprietário. */
  other: Participant;
  lastMessage: string;
  /** ISO, ou `null` numa conversa aberta sem nenhuma mensagem ainda. */
  lastMessageAt: string | null;
  unread: number;
};

export type ConversationDetail = ConversationSummary & {
  messages: ChatMessage[];
  /** Só o proprietário vê o botão de partilhar morada (07 §1.2.6). */
  canShareAddress: boolean;
  addressShared: boolean;
  buyerId: string;
};

// ---------------------------------------------------------------------------
// Visitas — 04 §8.3 "Agenda de visitas" e §8.4 "Pedidos de visitas"
// ---------------------------------------------------------------------------

export type VisitRow = {
  id: string;
  propertyId: string;
  propertyTitle: string;
  propertyLocation: string;
  /** O outro lado: o comprador na Agenda, o proprietário em Meus pedidos. */
  other: Participant;
  /** ISO da data e hora propostas para a visita. */
  proposedAt: string;
  message: string;
  status: VisitStatus;
  rescheduleCount: number;
  /**
   * `true` quando a data que está em cima da mesa foi proposta por mim — no
   * pedido inicial ou no último reagendamento. É o que decide, em 07 §5.6,
   * quem pode aceitar e quem pode propor outra data: nunca o mesmo lado duas
   * vezes seguidas.
   */
  proposedByMe: boolean;
};

// ---------------------------------------------------------------------------
// Leads — 04 §8.3 "Leads", 07 §18.2
// ---------------------------------------------------------------------------

export type LeadRow = {
  id: string;
  propertyId: string;
  propertyTitle: string;
  propertyLocation: string;
  contact: Participant;
  stage: LeadStage;
  outcome: LeadOutcome | null;
  /** Última mensagem da conversa, quando existe — a coluna "Interessado". */
  lastMessage: string;
  /** ISO. */
  lastActivityAt: string;
  /** Conversa aberta com este contacto, para o botão "Responder". */
  conversationId: string | null;
};

// ---------------------------------------------------------------------------
// Formatação — pt-PT em todo o lado (02 §12)
// ---------------------------------------------------------------------------

const TIME = new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit" });
const DAY = new Intl.DateTimeFormat("pt-PT", { day: "2-digit" });
const MONTH = new Intl.DateTimeFormat("pt-PT", { month: "short" });
const YEAR = new Intl.DateTimeFormat("pt-PT", { year: "numeric" });

/**
 * "26 set 2026", como a referência escreve as datas das visitas.
 *
 * Composta a partir de três formatadores em vez de um só com `month: "short"`:
 * em pt-PT, pedir dia + mês curto + ano devolve o padrão numérico do CLDR
 * ("26/09/2026") e o mês por extenso desaparece.
 */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${DAY.format(date)} ${MONTH.format(date).replace(".", "")} ${YEAR.format(date)}`;
}

export function formatTime(iso: string): string {
  return TIME.format(new Date(iso)).replace(":", "h");
}

export function formatDay(iso: string): { day: string; month: string } {
  const date = new Date(iso);
  return { day: DAY.format(date), month: MONTH.format(date).replace(".", "") };
}

/**
 * "há 2 horas", "ontem", "12 set" — a escala do protótipo na lista de
 * conversas e na coluna "Recebido" das leads. `now` entra por parâmetro para
 * o resultado ser determinístico nos testes e nas storyboards (um componente
 * que lê o relógio faz a storyboard flutuar no VRT).
 */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} ${hours === 1 ? "hora" : "horas"}`;
  const days = Math.round(hours / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  return formatDate(iso);
}

export function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}
