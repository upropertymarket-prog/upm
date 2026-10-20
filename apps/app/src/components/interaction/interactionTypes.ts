import type { LeadOutcome, LeadStage, MessageAttachment, VisitStatus } from "@upm/db/interaction";

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
  /** Anexos da mensagem (07 §19.6 · D28). Vazio na esmagadora maioria. */
  attachments: MessageAttachment[];
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

/**
 * Os formatadores recebem a etiqueta `Intl` do idioma escolhido (02 §12).
 * Estavam fixos em `pt-PT` — o que punha "set" e "há 2 horas" dentro de um
 * ecrã inglês. Instanciam-se por chamada e não no módulo, porque agora
 * dependem do idioma; o custo é desprezável ao lado de uma renderização.
 */

/**
 * "26 set 2026", como a referência escreve as datas das visitas.
 *
 * Composta a partir de três formatadores em vez de um só com `month: "short"`:
 * em pt-PT, pedir dia + mês curto + ano devolve o padrão numérico do CLDR
 * ("26/09/2026") e o mês por extenso desaparece.
 */
export function formatDate(iso: string, locale: string): string {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat(locale, { day: "2-digit" }).format(date);
  const month = new Intl.DateTimeFormat(locale, { month: "short" }).format(date).replace(".", "");
  const year = new Intl.DateTimeFormat(locale, { year: "numeric" }).format(date);
  return `${day} ${month} ${year}`;
}

/**
 * "16h30" em português. O `h` no lugar dos dois pontos é a convenção
 * portuguesa e sai errado em inglês, por isso só se troca em `pt`.
 */
export function formatTime(iso: string, locale: string): string {
  const formatted = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
  return locale.startsWith("pt") ? formatted.replace(":", "h") : formatted;
}

export function formatDay(iso: string, locale: string): { day: string; month: string } {
  const date = new Date(iso);
  return {
    day: new Intl.DateTimeFormat(locale, { day: "2-digit" }).format(date),
    month: new Intl.DateTimeFormat(locale, { month: "short" }).format(date).replace(".", ""),
  };
}

/**
 * "há 2 horas", "ontem", "12 set 2026" — a escala do protótipo na lista de
 * conversas e na coluna "Recebido" das leads. `now` entra por parâmetro para
 * o resultado ser determinístico nos testes e nas storyboards (um componente
 * que lê o relógio faz a storyboard flutuar no VRT).
 *
 * **As frases vêm do `Intl.RelativeTimeFormat` e não de chaves de tradução**,
 * de propósito: com `numeric: "auto"` ele já diz "agora", "há 2 horas" e
 * "ontem" em pt e "now", "2 hours ago" e "yesterday" em en, e escrever isso à
 * mão era reimplementar — com pior plural — o que o CLDR já sabe para as duas
 * línguas.
 */
export function formatRelative(iso: string, locale: string, now: Date = new Date()): string {
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const diff = now.getTime() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return relative.format(0, "second");
  if (minutes < 60) return relative.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return relative.format(-hours, "hour");
  const days = Math.round(hours / 24);
  if (days < 7) return relative.format(-days, "day");
  return formatDate(iso, locale);
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
