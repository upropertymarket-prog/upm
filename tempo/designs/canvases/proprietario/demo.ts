/**
 * Narração de canvas — dados de demonstração do canvas do Proprietário.
 *
 * Valores fixos de propósito: o `buildViewsSeries` da app lê o relógio, e uma
 * storyboard que renderiza diferente a cada montagem flutua no VRT.
 */
import type {
  DashboardStat,
  ViewsSeries,
} from "../../../../apps/app/src/components/dashboard/dashboardTypes";
import type { ActivityItem } from "../../../../apps/app/src/components/dashboard/RecentActivity";
import type {
  ConversationDetail,
  ConversationSummary,
  LeadRow,
  VisitRow,
} from "../../../../apps/app/src/components/interaction/interactionTypes";

export const demoLocaleChange = () => undefined;

/**
 * Datas fixas, nunca `Date.now()`: uma data relativa ao relógio muda o texto
 * ("há 2 horas") a cada montagem e faz a storyboard flutuar no VRT. Tudo é
 * ancorado a 29 set 2026, o dia dos protótipos.
 */
const DIA = "2026-09-29T";

/** As ações de escrita não fazem nada no canvas — não há sessão nem servidor. */
export const demoOk = async () => ({});
export const demoStartConversation = async () => ({ id: "c1" });

export const demoDashboardStats: DashboardStat[] = [
  {
    id: "active",
    icon: "building",
    label: "Imóveis ativos",
    value: "4",
    delta: "5 no total",
    deltaTone: "muted",
  },
  {
    // 07 §5.8: "visualizações" são consultas da página, "visitas" são físicas.
    id: "views",
    icon: "eye",
    label: "Visualizações dos imóveis",
    value: "1 245",
    delta: "+12% esta semana",
    deltaTone: "ok",
  },
  {
    id: "leads",
    icon: "leads",
    label: "Leads novas",
    value: "9",
    delta: "por contactar ou em conversa",
    deltaTone: "ok",
  },
  {
    id: "visits",
    icon: "visits",
    label: "Visitas agendadas",
    value: "3",
    delta: "2 por confirmar",
    deltaTone: "warn",
  },
];

export const demoViewsSeries: ViewsSeries[] = [
  {
    id: "7d",
    label: "7 dias",
    buckets: [
      { label: "qua", value: 142, srLabel: "23 de setembro" },
      { label: "qui", value: 186, srLabel: "24 de setembro" },
      { label: "sex", value: 164, srLabel: "25 de setembro" },
      { label: "sáb", value: 238, srLabel: "26 de setembro" },
      { label: "dom", value: 205, srLabel: "27 de setembro" },
      { label: "seg", value: 119, srLabel: "28 de setembro" },
      { label: "ter", value: 191, srLabel: "29 de setembro" },
    ],
  },
  {
    id: "30d",
    label: "30 dias",
    buckets: [
      { label: "s1", value: 780, srLabel: "Semana de 2 a 8 de setembro" },
      { label: "s2", value: 910, srLabel: "Semana de 9 a 15 de setembro" },
      { label: "s3", value: 1045, srLabel: "Semana de 16 a 22 de setembro" },
      { label: "s4", value: 1245, srLabel: "Semana de 23 a 29 de setembro" },
    ],
  },
  {
    id: "12m",
    label: "12 meses",
    buckets: [
      { label: "out", value: 1420, srLabel: "outubro de 2025" },
      { label: "nov", value: 1180, srLabel: "novembro de 2025" },
      { label: "dez", value: 940, srLabel: "dezembro de 2025" },
      { label: "jan", value: 1310, srLabel: "janeiro de 2026" },
      { label: "fev", value: 1495, srLabel: "fevereiro de 2026" },
      { label: "mar", value: 1860, srLabel: "março de 2026" },
      { label: "abr", value: 2100, srLabel: "abril de 2026" },
      { label: "mai", value: 2480, srLabel: "maio de 2026" },
      { label: "jun", value: 3010, srLabel: "junho de 2026" },
      { label: "jul", value: 3620, srLabel: "julho de 2026" },
      { label: "ago", value: 3180, srLabel: "agosto de 2026" },
      { label: "set", value: 4120, srLabel: "setembro de 2026" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Fase 5 — Interação. Os nomes e as frases são os da referência
// (`design/prototypes/App Proprietario.dc.html`): Ana Silva é a proprietária,
// João Costa, Marta Reis, Pedro Alves e Rita Bastos são os interessados.
// ---------------------------------------------------------------------------

export const demoUpcomingVisits: VisitRow[] = [
  {
    id: "v1",
    propertyId: "p1",
    propertyTitle: "Moradia T4 com jardim",
    propertyLocation: "Cascais · Birre",
    other: { id: "u2", name: "Marta Reis", initials: "MR" },
    proposedAt: `${DIA}16:30:00Z`,
    message: "Gostava de ver o anexo convertido.",
    status: "pending",
    rescheduleCount: 1,
    proposedByMe: false,
  },
  {
    id: "v2",
    propertyId: "p2",
    propertyTitle: "Loft industrial T1",
    propertyLocation: "Lisboa · Marvila",
    other: { id: "u3", name: "Pedro Alves", initials: "PA" },
    proposedAt: "2026-10-01T18:00:00Z",
    message: "",
    status: "accepted",
    rescheduleCount: 2,
    proposedByMe: true,
  },
  {
    id: "v3",
    propertyId: "p3",
    propertyTitle: "Apartamento T3 com varanda",
    propertyLocation: "Lisboa · Campo de Ourique",
    other: { id: "u1", name: "João Costa", initials: "JC" },
    proposedAt: "2026-10-03T11:00:00Z",
    message: "Seria possível visitar sábado de manhã?",
    status: "pending",
    rescheduleCount: 0,
    proposedByMe: false,
  },
];

/** A agenda mostra também o que já passou — daí as duas linhas fechadas. */
export const demoVisits: VisitRow[] = [
  ...demoUpcomingVisits,
  {
    id: "v4",
    propertyId: "p3",
    propertyTitle: "Apartamento T3 com varanda",
    propertyLocation: "Lisboa · Campo de Ourique",
    other: { id: "u4", name: "Rita Bastos", initials: "RB" },
    proposedAt: "2026-09-12T15:00:00Z",
    message: "Visita realizada, aguarda proposta.",
    status: "completed",
    rescheduleCount: 0,
    proposedByMe: false,
  },
  {
    id: "v5",
    propertyId: "p1",
    propertyTitle: "Moradia T4 com jardim",
    propertyLocation: "Cascais · Birre",
    other: { id: "u5", name: "Inês Faria", initials: "IF" },
    proposedAt: "2026-09-09T10:30:00Z",
    message: "",
    status: "cancelled",
    rescheduleCount: 3,
    proposedByMe: true,
  },
];

export const demoConversations: ConversationSummary[] = [
  {
    id: "c1",
    propertyId: "p3",
    propertyTitle: "T3 · Campo de Ourique",
    propertyLocation: "Lisboa",
    other: { id: "u1", name: "João Costa", initials: "JC" },
    lastMessage: "Seria possível visitar sábado?",
    lastMessageAt: `${DIA}09:12:00Z`,
    unread: 2,
  },
  {
    id: "c2",
    propertyId: "p1",
    propertyTitle: "Moradia T4 · Birre",
    propertyLocation: "Cascais",
    other: { id: "u2", name: "Marta Reis", initials: "MR" },
    lastMessage: "A planta inclui o anexo?",
    lastMessageAt: "2026-09-28T11:58:00Z",
    unread: 1,
  },
  {
    id: "c3",
    propertyId: "p2",
    propertyTitle: "Loft T1 · Marvila",
    propertyLocation: "Lisboa",
    other: { id: "u3", name: "Pedro Alves", initials: "PA" },
    lastMessage: "Proposta de 310 000 €",
    lastMessageAt: "2026-09-27T10:31:00Z",
    unread: 0,
  },
  {
    id: "c4",
    propertyId: "p3",
    propertyTitle: "T3 · Campo de Ourique",
    propertyLocation: "Lisboa",
    other: { id: "u4", name: "Rita Bastos", initials: "RB" },
    lastMessage: "Obrigada pela visita!",
    lastMessageAt: "2026-09-24T19:40:00Z",
    unread: 0,
  },
];

export const demoConversation: ConversationDetail = {
  ...demoConversations[0]!,
  buyerId: "u1",
  canShareAddress: true,
  addressShared: false,
  messages: [
    {
      id: "m1",
      body: "Boa tarde! Vi o anúncio do T3 e gostava de saber se a garagem é individual.",
      createdAt: "2026-09-28T17:40:00Z",
      mine: false,
      read: true,
    },
    {
      id: "m2",
      body: "Boa tarde, João. É individual, com portão automático e arrecadação anexa.",
      createdAt: "2026-09-28T18:02:00Z",
      mine: true,
      read: true,
    },
    {
      id: "m3",
      body: "Seria possível visitar sábado de manhã?",
      createdAt: `${DIA}09:12:00Z`,
      mine: false,
      read: false,
    },
  ],
};

export const demoLeads: LeadRow[] = [
  {
    id: "l1",
    propertyId: "p3",
    propertyTitle: "Apartamento T3",
    propertyLocation: "Campo de Ourique",
    contact: { id: "u1", name: "João Costa", initials: "JC" },
    stage: "contacted",
    outcome: null,
    lastMessage: "Seria possível visitar sábado de manhã?",
    lastActivityAt: `${DIA}09:12:00Z`,
    conversationId: "c1",
  },
  {
    id: "l2",
    propertyId: "p1",
    propertyTitle: "Moradia T4",
    propertyLocation: "Birre",
    contact: { id: "u2", name: "Marta Reis", initials: "MR" },
    stage: "new",
    outcome: null,
    lastMessage: "A planta inclui o anexo convertido?",
    lastActivityAt: "2026-09-28T11:20:00Z",
    conversationId: "c2",
  },
  {
    id: "l3",
    propertyId: "p2",
    propertyTitle: "Loft T1",
    propertyLocation: "Marvila",
    contact: { id: "u3", name: "Pedro Alves", initials: "PA" },
    stage: "visit",
    outcome: null,
    lastMessage: "Proposta de 310 000 € com escritura em 60 dias.",
    lastActivityAt: "2026-09-27T10:04:00Z",
    conversationId: "c3",
  },
  {
    id: "l4",
    propertyId: "p3",
    propertyTitle: "Apartamento T3",
    propertyLocation: "Campo de Ourique",
    contact: { id: "u4", name: "Rita Bastos", initials: "RB" },
    stage: "closed",
    outcome: "won",
    lastMessage: "Obrigada pela visita, gostei muito do apartamento.",
    lastActivityAt: "2026-09-24T19:12:00Z",
    conversationId: "c4",
  },
];

export const demoRecentMessages: ActivityItem[] = [
  {
    id: "c1",
    title: "João Costa · T3 Campo de Ourique",
    subtitle: "«Seria possível visitar sábado?»",
    href: "/mensagens?conversa=c1",
    tag: "Novo",
    tone: "new",
  },
  {
    id: "c2",
    title: "Marta Reis · Moradia T4",
    subtitle: "«A planta inclui o anexo?»",
    href: "/mensagens?conversa=c2",
    tag: "Novo",
    tone: "new",
  },
  {
    id: "c3",
    title: "Pedro Alves · Loft T1",
    subtitle: "«Proposta de 310 000 €»",
    href: "/mensagens?conversa=c3",
    tag: "Lido",
    tone: "archived",
  },
];

/**
 * "Contratos" do bloco de atividade recente — 07 §19.12.
 *
 * Era `demoRecentDocuments` até à Fase 6, quando o painel se chamava
 * "Documentos e contratos" e mostrava só documentos (D29). Passou a contratos
 * com o painel, e os três estados escolhidos são de propósito diferentes: um
 * painel de atividade recente só vale se mostrar coisas em pontos diferentes
 * do ciclo.
 */
export const demoRecentContracts: ActivityItem[] = [
  {
    id: "c1",
    title: "Contrato de reserva · Apartamento T3",
    subtitle: "com João Costa · há 2 dias",
    href: "/contratos/c1",
    tag: "Por assinar",
    tone: "pending",
  },
  {
    id: "c2",
    title: "Contrato de arrendamento · Loft T1",
    subtitle: "com Marta Nunes · há 6 dias",
    href: "/contratos/c2",
    tag: "Assinado",
    tone: "active",
  },
  {
    id: "c3",
    title: "Contrato de compra e venda · Moradia T4",
    subtitle: "há 9 dias",
    href: "/contratos/c3",
    tag: "Rascunho",
    tone: "draft",
  },
];

/** O sino com o que a referência mostra no dropdown de notificações. */
export const demoNotifications = [
  {
    id: "n1",
    text: "Novo pedido de visita — João Costa pediu visita ao T3 Campo de Ourique para sábado, 3 out às 11h00.",
    when: "há 12 minutos",
    read: false,
    href: "/agenda",
  },
  {
    id: "n2",
    text: "Nova mensagem de Marta Reis — «A planta inclui o anexo convertido?»",
    when: "há 2 horas",
    read: false,
    href: "/mensagens",
  },
  {
    id: "n3",
    text: "Visita confirmada — Loft T1 Marvila, 1 out às 18h00.",
    when: "há 2 dias",
    read: true,
    href: "/agenda",
  },
];
