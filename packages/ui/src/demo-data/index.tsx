import {
  Bug,
  Building2,
  CalendarCheck,
  CalendarDays,
  Cloud,
  CreditCard,
  FileSignature,
  Heart,
  LayoutDashboard,
  Map,
  MessagesSquare,
  Settings,
  Store,
  Users,
} from "lucide-react";

import type { StatusTone } from "../components/StatusTag";

/**
 * Dados da demonstração interativa do site público (P2-04 · 07 §7)
 * =========================================================================
 * **Estático, e é esse o ponto.** 07 §7 decidiu que a demo não toca na app
 * autenticada: "a rota `?demo=1` em app.upropertymarket.pt é eliminada. Era a
 * única via de expor rotas autenticadas ao público, e não vale o risco."
 *
 * O que substitui essa rota é este módulo: os ecrãs de Proprietário e Comprador
 * montam-se **dentro de `apps/web`** com os componentes reais de `@upm/ui`,
 * alimentados por estas fixtures. Sem sessão, sem cliente Supabase, sem um
 * único pedido de rede, sem RLS no caminho. Nada aqui é escrito e nada daqui
 * sai para a base de dados.
 *
 * Vive em `packages/ui` e não em `apps/web` por indicação expressa de 07 §7
 * ("um módulo de fixtures estático — `packages/ui/src/demo-data`").
 *
 * ## Aqui só entram dados. Texto, nunca
 *
 * Até 27 out 2026 este ficheiro tinha rótulos escritos à mão — "Painel",
 * "Visualizações", "há 12 min" — e a demonstração aparecia em português a um
 * visitante que estivesse a ver o site em inglês. A pasta `demo-data` está
 * isenta do portão de i18n (`scripts/gate/check-i18n.mjs`), e foi exatamente
 * nessa isenção que o problema se escondeu: o portão estava verde e metade da
 * demonstração era monolingue.
 *
 * A regra passou a ser esta, e é o que explica a forma de cada tipo abaixo:
 *
 *  - **rótulos** são chaves de `messages/*.json`. Os ids das secções *são* as
 *    chaves de `nav.*`, as dos KPI apontam para `dashboard.*`, os estados para
 *    `leads.stage.*`, `visits.status.*`, `property.status.*`;
 *  - **tempo** são deslocamentos (`minutesAgo`, `dayOffset`) que o ecrã
 *    formata com `Intl` — e que, de bónus, nunca envelhecem;
 *  - **dinheiro** são cêntimos, formatados com `Intl.NumberFormat`;
 *  - **frases de pessoas** (uma mensagem numa conversa) são chaves de
 *    `site.demo.*`.
 *
 * O que fica como literal é conteúdo de utilizador: nomes de pessoas, títulos
 * de anúncios, cidades, nomes de ficheiros. Na plataforma a sério esse texto é
 * escrito por quem publica e também não se traduz.
 *
 * **As pessoas e os números são inventados, os ecrãs não.** A ordem dos menus é
 * a de 05 §1.2, à letra — é o que faz um visitante reconhecer o produto quando
 * entrar nele a sério. Suporte não entra: 05 §1.1 diz "demonstração com as UIs
 * reais de Proprietário e Comprador (sem Suporte)".
 */

/* ------------------------------------------------------------------------ */
/* Navegação                                                                 */
/* ------------------------------------------------------------------------ */

/**
 * As secções que a demonstração sabe desenhar.
 *
 * Cada id é, à letra, uma chave de `nav.*` em `messages/*.json` — e é também o
 * `activeId` que o ecrã verdadeiro passa ao `AppShell` (ver `activeId="cloud"`
 * em `apps/app/src/app/cloud/page.tsx`). Um vocabulário só para as três
 * coisas: o menu, o rótulo e o ecrã.
 */
export type DemoSectionId =
  | "dashboard"
  | "market"
  | "myProperties"
  | "leads"
  | "messages"
  | "visitSchedule"
  | "myRequests"
  | "saved"
  | "map"
  | "cloud"
  | "contracts"
  | "myReports"
  | "plan"
  | "settings";

export type DemoNavItem = {
  id: DemoSectionId;
  /**
   * A rota onde a secção vive **no produto** (`/painel`, `/market`, …).
   *
   * Na demonstração ninguém a segue: quem desenha o menu passa um `renderLink`
   * que devolve um `<button>` e troca o ecrã dentro da caixa. Está aqui porque
   * um item de menu tem um destino, e porque o que lá estava antes era
   * `href="#"` — e um `#` **é** uma navegação: o browser salta para o topo do
   * documento, que no site público é o topo da home. Era esse o defeito.
   */
  href: string;
  icon: React.ReactNode;
  /** Contador laranja de novos/não lidos/pendentes (07 §4.2). */
  count?: number;
};

const NAV_ICON = { size: 18, "aria-hidden": true } as const;

/** Menu do Proprietário — 05 §1.2, pela mesma ordem do produto. */
export const DEMO_OWNER_NAV_ITEMS: DemoNavItem[] = [
  { id: "dashboard", href: "/painel", icon: <LayoutDashboard {...NAV_ICON} /> },
  { id: "market", href: "/market", icon: <Store {...NAV_ICON} /> },
  { id: "myProperties", href: "/propriedades", icon: <Building2 {...NAV_ICON} />, count: 3 },
  { id: "leads", href: "/leads", icon: <Users {...NAV_ICON} />, count: 5 },
  { id: "messages", href: "/mensagens", icon: <MessagesSquare {...NAV_ICON} />, count: 2 },
  { id: "visitSchedule", href: "/agenda", icon: <CalendarDays {...NAV_ICON} /> },
  { id: "map", href: "/mapa", icon: <Map {...NAV_ICON} /> },
  { id: "cloud", href: "/cloud", icon: <Cloud {...NAV_ICON} /> },
  { id: "contracts", href: "/contratos", icon: <FileSignature {...NAV_ICON} /> },
  { id: "myReports", href: "/reports", icon: <Bug {...NAV_ICON} /> },
  { id: "plan", href: "/plano", icon: <CreditCard {...NAV_ICON} /> },
  { id: "settings", href: "/definicoes", icon: <Settings {...NAV_ICON} /> },
];

/** Menu do Comprador — 05 §1.2. */
export const DEMO_BUYER_NAV_ITEMS: DemoNavItem[] = [
  { id: "dashboard", href: "/painel", icon: <LayoutDashboard {...NAV_ICON} /> },
  { id: "market", href: "/market", icon: <Store {...NAV_ICON} /> },
  { id: "messages", href: "/mensagens", icon: <MessagesSquare {...NAV_ICON} />, count: 1 },
  { id: "myRequests", href: "/meus-pedidos", icon: <CalendarCheck {...NAV_ICON} /> },
  { id: "saved", href: "/guardados", icon: <Heart {...NAV_ICON} />, count: 8 },
  { id: "map", href: "/mapa", icon: <Map {...NAV_ICON} /> },
  { id: "cloud", href: "/cloud", icon: <Cloud {...NAV_ICON} /> },
  { id: "contracts", href: "/contratos", icon: <FileSignature {...NAV_ICON} /> },
  { id: "myReports", href: "/reports", icon: <Bug {...NAV_ICON} /> },
  { id: "plan", href: "/plano", icon: <CreditCard {...NAV_ICON} /> },
  { id: "settings", href: "/definicoes", icon: <Settings {...NAV_ICON} /> },
];

/* ------------------------------------------------------------------------ */
/* Chrome: utilizador, notificações, idiomas                                 */
/* ------------------------------------------------------------------------ */

/**
 * Quem está "com sessão aberta" na demonstração.
 *
 * `meta` não vem daqui: é `roles.*` + o nome do plano, composto por quem
 * desenha a barra lateral — "Proprietária · Smarter" escrito aqui era uma
 * frase, e as frases traduzem-se.
 */
export type DemoUser = { name: string; initials: string; planName: string };

export const DEMO_OWNER_USER: DemoUser = {
  name: "Marta Oliveira",
  initials: "MO",
  planName: "Smarter",
};

export const DEMO_BUYER_USER: DemoUser = {
  name: "Rui Pereira",
  initials: "RP",
  planName: "Essential",
};

/** Uma notificação do sino. O texto é uma chave de `site.demo.notifications`. */
export type DemoNotification = {
  id: string;
  textKey: string;
  textParams?: Record<string, string>;
  minutesAgo: number;
  read: boolean;
};

export const DEMO_OWNER_NOTIFICATIONS: DemoNotification[] = [
  {
    id: "n1",
    textKey: "visitRequest",
    textParams: { property: "T2 com varanda" },
    minutesAgo: 12,
    read: false,
  },
  {
    id: "n2",
    textKey: "messageAnswered",
    textParams: { name: "Rui Pereira" },
    minutesAgo: 64,
    read: false,
  },
  {
    id: "n3",
    textKey: "listingApproved",
    textParams: { property: "Moradia T4 com jardim" },
    minutesAgo: 1500,
    read: true,
  },
];

export const DEMO_BUYER_NOTIFICATIONS: DemoNotification[] = [
  {
    id: "n1",
    textKey: "priceDrop",
    textParams: { property: "T1 mobilado junto ao metro" },
    minutesAgo: 30,
    read: false,
  },
  {
    id: "n2",
    textKey: "visitConfirmed",
    textParams: { property: "T2 com varanda" },
    minutesAgo: 190,
    read: true,
  },
];

/* ------------------------------------------------------------------------ */
/* Painel                                                                    */
/* ------------------------------------------------------------------------ */

/** Os ícones que `DashboardStats` desenha, por significado e não por nome. */
export type DemoStatIcon =
  "building" | "eye" | "leads" | "visits" | "saved" | "messages" | "contracts";

/**
 * Um KPI de "As suas estatísticas" (04 §8.3).
 *
 * `labelKey` e `hintKey` são caminhos **dentro de `dashboard`**, por isso o
 * ecrã lê-os com um `useTranslations("dashboard")` só. O valor é um número e é
 * formatado com `Intl`: "1 284" e "1,284" não se escrevem da mesma maneira.
 */
export type DemoStat = {
  id: string;
  icon: DemoStatIcon;
  labelKey: string;
  value: number;
  hintKey: string;
  /** Texto quando o sinal faz parte do valor ("+18%"), número no resto. */
  hintParams?: Record<string, string | number>;
  hintTone: "ok" | "warn" | "muted";
};

export const DEMO_OWNER_STATS: DemoStat[] = [
  {
    id: "active",
    icon: "building",
    labelKey: "stats.activeLabel",
    value: 3,
    hintKey: "stats.activeTotal",
    hintParams: { count: 4 },
    hintTone: "muted",
  },
  {
    id: "views",
    icon: "eye",
    labelKey: "stats.viewsLabel",
    value: 1284,
    hintKey: "chart.changeThisWeek",
    hintParams: { change: "+18" },
    hintTone: "ok",
  },
  {
    id: "leads",
    icon: "leads",
    labelKey: "stats.leadsLabel",
    value: 5,
    hintKey: "stats.leadsSome",
    hintTone: "warn",
  },
  {
    id: "visits",
    icon: "visits",
    labelKey: "stats.visitsLabel",
    value: 3,
    hintKey: "stats.visitsAwaiting",
    hintParams: { count: 1 },
    hintTone: "muted",
  },
];

export const DEMO_BUYER_STATS: DemoStat[] = [
  {
    id: "saved",
    icon: "saved",
    labelKey: "stats.savedLabel",
    value: 8,
    hintKey: "stats.savedSome",
    hintTone: "muted",
  },
  {
    id: "requested",
    icon: "visits",
    labelKey: "stats.requestedLabel",
    value: 2,
    hintKey: "stats.requestedConfirmed",
    hintParams: { count: 1 },
    hintTone: "ok",
  },
  {
    id: "chats",
    icon: "messages",
    labelKey: "stats.chatsLabel",
    value: 3,
    hintKey: "stats.chatsUnread",
    hintParams: { count: 1 },
    hintTone: "warn",
  },
  {
    id: "contracts",
    icon: "contracts",
    labelKey: "stats.contractsLabel",
    value: 1,
    hintKey: "stats.contractsSome",
    hintTone: "muted",
  },
];

/**
 * Uma série do gráfico do Painel.
 *
 * Só os valores: as etiquetas das barras são datas, e datas escrevem-se à
 * maneira de cada idioma. O ecrã conta para trás a partir de hoje — `day` dá
 * sete dias, `week` dá quatro semanas — e formata cada uma com `Intl`. Os ids
 * são as chaves de `dashboard.chart.*` que nomeiam os intervalos.
 */
export type DemoSeries = {
  id: "range7d" | "range30d";
  granularity: "day" | "week";
  values: number[];
};

export const DEMO_OWNER_VIEWS: DemoSeries[] = [
  { id: "range7d", granularity: "day", values: [112, 98, 143, 120, 167, 189, 203] },
  { id: "range30d", granularity: "week", values: [640, 712, 803, 884] },
];

export const DEMO_BUYER_VIEWS: DemoSeries[] = [
  { id: "range7d", granularity: "day", values: [4, 7, 3, 9, 6, 11, 8] },
  { id: "range30d", granularity: "week", values: [21, 26, 18, 34] },
];

/**
 * Uma linha de "Atividade recente" (04 §8.3).
 *
 * `title` é conteúdo (o imóvel, o contrato); a legenda compõe-se com
 * `contracts.activity.withCounterparty`, que já é bilingue, a partir de `person`
 * e do tempo relativo.
 */
export type DemoActivity = {
  id: string;
  title: string;
  person: string;
  minutesAgo: number;
  /** Chave do estado e o tom que lhe corresponde (04 §5.6). */
  tagKey: string;
  tone: StatusTone;
};

export const DEMO_OWNER_ACTIVITY_MESSAGES: DemoActivity[] = [
  {
    id: "am1",
    title: "T2 com varanda",
    person: "Rui Pereira",
    minutesAgo: 12,
    tagKey: "dashboard.activity.new",
    tone: "new",
  },
  {
    id: "am2",
    title: "Moradia T4 com jardim",
    person: "Ana Dias",
    minutesAgo: 120,
    tagKey: "dashboard.activity.read",
    tone: "archived",
  },
];

export const DEMO_OWNER_ACTIVITY_CONTRACTS: DemoActivity[] = [
  {
    id: "ac1",
    title: "Contrato de arrendamento · T1 Lisboa",
    person: "Sofia Lima",
    minutesAgo: 300,
    tagKey: "contracts.status.awaiting_signature",
    tone: "pending",
  },
  {
    id: "ac2",
    title: "Compra e venda · Moradia T4 Braga",
    person: "Ana Dias",
    minutesAgo: 2880,
    tagKey: "contracts.status.signed",
    tone: "active",
  },
];

export const DEMO_BUYER_ACTIVITY_MESSAGES: DemoActivity[] = [
  {
    id: "bm1",
    title: "T2 com varanda",
    person: "Marta Oliveira",
    minutesAgo: 45,
    tagKey: "dashboard.activity.new",
    tone: "new",
  },
  {
    id: "bm2",
    title: "Estúdio remodelado",
    person: "Hugo Matos",
    minutesAgo: 1440,
    tagKey: "dashboard.activity.read",
    tone: "archived",
  },
];

export const DEMO_BUYER_ACTIVITY_CONTRACTS: DemoActivity[] = [
  {
    id: "bc1",
    title: "Contrato de arrendamento · T1 Lisboa",
    person: "Sofia Lima",
    minutesAgo: 300,
    tagKey: "contracts.status.awaiting_signature",
    tone: "pending",
  },
];

/* ------------------------------------------------------------------------ */
/* Market, Guardados e Mapa                                                  */
/* ------------------------------------------------------------------------ */

/**
 * Um anúncio. Sem `coverUrl`: o projeto não tem fotografias, e um `<img>` para
 * um ficheiro que não existe é pior do que a moldura vazia que o cartão desenha.
 */
export type DemoListing = {
  id: string;
  title: string;
  city: string;
  typology: string;
  /** Área bruta, em m². */
  area: number;
  bathrooms: number;
  deal: "sale" | "rent";
  /** Em cêntimos: venda ou renda, conforme `deal`. */
  cents: number;
  /** O preço a que foi guardado, quando mudou desde então (04 §2.5). */
  previousCents?: number;
  saved: boolean;
  /** Posição no mapa, em percentagem da caixa — é um mapa ilustrativo. */
  pin: { x: number; y: number };
};

export const DEMO_LISTINGS: DemoListing[] = [
  {
    id: "p1",
    title: "Apartamento T2 com varanda",
    city: "Porto",
    typology: "T2",
    area: 88,
    bathrooms: 2,
    deal: "sale",
    cents: 24_500_000,
    saved: true,
    pin: { x: 32, y: 24 },
  },
  {
    id: "p2",
    title: "Moradia T4 com jardim",
    city: "Braga",
    typology: "T4",
    area: 210,
    bathrooms: 3,
    deal: "sale",
    cents: 39_000_000,
    saved: false,
    pin: { x: 44, y: 14 },
  },
  {
    id: "p3",
    title: "T1 mobilado junto ao metro",
    city: "Lisboa",
    typology: "T1",
    area: 46,
    bathrooms: 1,
    deal: "rent",
    cents: 95_000,
    previousCents: 102_000,
    saved: true,
    pin: { x: 22, y: 68 },
  },
  {
    id: "p4",
    title: "Estúdio remodelado",
    city: "Coimbra",
    typology: "T0",
    area: 32,
    bathrooms: 1,
    deal: "rent",
    cents: 58_000,
    saved: false,
    pin: { x: 36, y: 46 },
  },
  {
    id: "p5",
    title: "Apartamento T3 com vista de rio",
    city: "Porto",
    typology: "T3",
    area: 134,
    bathrooms: 2,
    deal: "sale",
    cents: 41_000_000,
    saved: true,
    pin: { x: 29, y: 27 },
  },
  {
    id: "p6",
    title: "T2 em prédio novo",
    city: "Aveiro",
    typology: "T2",
    area: 96,
    bathrooms: 2,
    deal: "rent",
    cents: 85_000,
    saved: false,
    pin: { x: 30, y: 38 },
  },
];

/* ------------------------------------------------------------------------ */
/* As minhas propriedades                                                    */
/* ------------------------------------------------------------------------ */

/** `status` é uma chave de `property.status.*` — o mesmo vocabulário da app. */
export type DemoProperty = {
  id: string;
  title: string;
  status: "active" | "featured" | "pending_review" | "draft";
  cents: number | null;
  views: number;
};

export const DEMO_OWNER_PROPERTIES: DemoProperty[] = [
  {
    id: "o1",
    title: "Apartamento T2 com varanda",
    status: "active",
    cents: 24_500_000,
    views: 612,
  },
  { id: "o2", title: "Moradia T4 com jardim", status: "featured", cents: 39_000_000, views: 498 },
  {
    id: "o3",
    title: "Apartamento T3 com vista de rio",
    status: "pending_review",
    cents: 41_000_000,
    views: 174,
  },
  { id: "o4", title: "Loja no centro", status: "draft", cents: null, views: 0 },
];

/* ------------------------------------------------------------------------ */
/* Leads                                                                     */
/* ------------------------------------------------------------------------ */

/**
 * Uma lead. `stage` é o funil de `LEAD_STAGES` (07 §18.2) e a chave de
 * `leads.stage.*`; a última mensagem é uma chave de `site.demo.thread`.
 */
export type DemoLead = {
  id: string;
  name: string;
  initials: string;
  property: string;
  city: string;
  messageKey: string;
  minutesAgo: number;
  stage: "new" | "contacted" | "visit" | "closed";
  outcome?: "won" | "lost";
};

export const DEMO_OWNER_LEADS: DemoLead[] = [
  {
    id: "l1",
    name: "Rui Pereira",
    initials: "RP",
    property: "T2 com varanda",
    city: "Porto",
    messageKey: "askVisit",
    minutesAgo: 12,
    stage: "new",
  },
  {
    id: "l2",
    name: "Ana Dias",
    initials: "AD",
    property: "Moradia T4 com jardim",
    city: "Braga",
    messageKey: "askCondo",
    minutesAgo: 120,
    stage: "contacted",
  },
  {
    id: "l3",
    name: "Pedro Nunes",
    initials: "PN",
    property: "T2 com varanda",
    city: "Porto",
    messageKey: "confirmVisit",
    minutesAgo: 1440,
    stage: "visit",
  },
  {
    id: "l4",
    name: "Sofia Lima",
    initials: "SL",
    property: "T1 mobilado junto ao metro",
    city: "Lisboa",
    messageKey: "askDocuments",
    minutesAgo: 2880,
    stage: "contacted",
  },
  {
    id: "l5",
    name: "Hugo Matos",
    initials: "HM",
    property: "Estúdio remodelado",
    city: "Coimbra",
    messageKey: "thanks",
    minutesAgo: 10_080,
    stage: "closed",
    outcome: "won",
  },
];

/* ------------------------------------------------------------------------ */
/* Mensagens                                                                 */
/* ------------------------------------------------------------------------ */

/** Uma bolha. `key` aponta para `site.demo.thread.*`; `mine` é de quem olha. */
export type DemoMessage = { id: string; key: string; mine: boolean; minutesAgo: number };

export type DemoConversation = {
  id: string;
  /** O outro lado da conversa — para o Proprietário é quem procura, e vice-versa. */
  other: string;
  initials: string;
  property: string;
  unread: number;
  messages: DemoMessage[];
};

export const DEMO_OWNER_CONVERSATIONS: DemoConversation[] = [
  {
    id: "c1",
    other: "Rui Pereira",
    initials: "RP",
    property: "T2 com varanda · Porto",
    unread: 2,
    messages: [
      { id: "m1", key: "askVisit", mine: false, minutesAgo: 58 },
      { id: "m2", key: "ownerProposes", mine: true, minutesAgo: 44 },
      { id: "m3", key: "buyerAccepts", mine: false, minutesAgo: 12 },
    ],
  },
  {
    id: "c2",
    other: "Ana Dias",
    initials: "AD",
    property: "Moradia T4 com jardim · Braga",
    unread: 0,
    messages: [
      { id: "m1", key: "askCondo", mine: false, minutesAgo: 240 },
      { id: "m2", key: "ownerAnswersCondo", mine: true, minutesAgo: 120 },
    ],
  },
  {
    id: "c3",
    other: "Sofia Lima",
    initials: "SL",
    property: "T1 mobilado junto ao metro · Lisboa",
    unread: 0,
    messages: [
      { id: "m1", key: "askDocuments", mine: false, minutesAgo: 2880 },
      { id: "m2", key: "ownerSharesDocuments", mine: true, minutesAgo: 2820 },
      { id: "m3", key: "thanks", mine: false, minutesAgo: 2760 },
    ],
  },
];

export const DEMO_BUYER_CONVERSATIONS: DemoConversation[] = [
  {
    id: "c1",
    other: "Marta Oliveira",
    initials: "MO",
    property: "T2 com varanda · Porto",
    unread: 1,
    messages: [
      { id: "m1", key: "askVisit", mine: true, minutesAgo: 58 },
      { id: "m2", key: "ownerProposes", mine: false, minutesAgo: 44 },
      { id: "m3", key: "buyerAccepts", mine: true, minutesAgo: 12 },
    ],
  },
  {
    id: "c2",
    other: "Hugo Matos",
    initials: "HM",
    property: "Estúdio remodelado · Coimbra",
    unread: 0,
    messages: [
      { id: "m1", key: "askDocuments", mine: true, minutesAgo: 1500 },
      { id: "m2", key: "ownerSharesDocuments", mine: false, minutesAgo: 1440 },
    ],
  },
];

/* ------------------------------------------------------------------------ */
/* Visitas                                                                   */
/* ------------------------------------------------------------------------ */

/**
 * Um pedido de visita. `status` é a chave de `visits.status.*`; a data é um
 * deslocamento em dias a partir de hoje, com a hora em minutos desde a
 * meia-noite — assim a agenda da demonstração nunca mostra uma visita no
 * passado por o site ter ficado um mês no ar.
 */
export type DemoVisit = {
  id: string;
  other: string;
  initials: string;
  property: string;
  city: string;
  dayOffset: number;
  minuteOfDay: number;
  status: "pending" | "accepted" | "rescheduled" | "completed";
};

export const DEMO_OWNER_VISITS: DemoVisit[] = [
  {
    id: "v1",
    other: "Rui Pereira",
    initials: "RP",
    property: "T2 com varanda",
    city: "Porto",
    dayOffset: 2,
    minuteOfDay: 15 * 60 + 30,
    status: "accepted",
  },
  {
    id: "v2",
    other: "Pedro Nunes",
    initials: "PN",
    property: "T2 com varanda",
    city: "Porto",
    dayOffset: 4,
    minuteOfDay: 11 * 60,
    status: "pending",
  },
  {
    id: "v3",
    other: "Ana Dias",
    initials: "AD",
    property: "Moradia T4 com jardim",
    city: "Braga",
    dayOffset: 6,
    minuteOfDay: 18 * 60,
    status: "rescheduled",
  },
  {
    id: "v4",
    other: "Sofia Lima",
    initials: "SL",
    property: "T1 mobilado junto ao metro",
    city: "Lisboa",
    dayOffset: -3,
    minuteOfDay: 10 * 60 + 30,
    status: "completed",
  },
];

export const DEMO_BUYER_VISITS: DemoVisit[] = [
  {
    id: "v1",
    other: "Marta Oliveira",
    initials: "MO",
    property: "T2 com varanda",
    city: "Porto",
    dayOffset: 2,
    minuteOfDay: 15 * 60 + 30,
    status: "accepted",
  },
  {
    id: "v2",
    other: "Hugo Matos",
    initials: "HM",
    property: "Estúdio remodelado",
    city: "Coimbra",
    dayOffset: 5,
    minuteOfDay: 17 * 60,
    status: "pending",
  },
];

/* ------------------------------------------------------------------------ */
/* Cloud                                                                     */
/* ------------------------------------------------------------------------ */

export type DemoFolder = { id: string; name: string };

/**
 * Um ficheiro da Cloud. `sourceKey`, quando existe, é a chave de
 * `cloud.source.*` que diz de onde o ficheiro veio (07 §19.5).
 */
export type DemoFile = {
  id: string;
  name: string;
  folderId: string;
  bytes: number;
  daysAgo: number;
  sourceKey?: string;
  sharedWith?: string;
};

export const DEMO_OWNER_FOLDERS: DemoFolder[] = [
  { id: "f1", name: "Documentos do imóvel" },
  { id: "f2", name: "Escrituras" },
  { id: "f3", name: "Faturas" },
];

export const DEMO_OWNER_FILES: DemoFile[] = [
  {
    id: "d1",
    name: "certidao-permanente.pdf",
    folderId: "f1",
    bytes: 428_000,
    daysAgo: 2,
    sourceKey: "property_document",
  },
  {
    id: "d2",
    name: "planta-t2-porto.pdf",
    folderId: "f1",
    bytes: 1_240_000,
    daysAgo: 2,
    sourceKey: "property_document",
    sharedWith: "Rui Pereira",
  },
  { id: "d3", name: "certificado-energetico.pdf", folderId: "f1", bytes: 316_000, daysAgo: 9 },
  { id: "d4", name: "escritura-moradia-braga.pdf", folderId: "f2", bytes: 2_180_000, daysAgo: 21 },
  {
    id: "d5",
    name: "fatura-2026-0104.pdf",
    folderId: "f3",
    bytes: 96_000,
    daysAgo: 6,
    sourceKey: "invoice",
  },
];

export const DEMO_BUYER_FOLDERS: DemoFolder[] = [{ id: "f1", name: "Partilhados comigo" }];

export const DEMO_BUYER_FILES: DemoFile[] = [
  {
    id: "d1",
    name: "planta-t2-porto.pdf",
    folderId: "f1",
    bytes: 1_240_000,
    daysAgo: 1,
    sourceKey: "property_document",
    sharedWith: "Marta Oliveira",
  },
  {
    id: "d2",
    name: "contrato-arrendamento-t1.pdf",
    folderId: "f1",
    bytes: 204_000,
    daysAgo: 4,
    sourceKey: "contract",
  },
];

/** Quota do plano, em bytes — a barra de 07 §19.9. */
export const DEMO_OWNER_STORAGE = { usedBytes: 4_264_000, limitBytes: 5 * 1024 ** 3 };
export const DEMO_BUYER_STORAGE = { usedBytes: 1_444_000, limitBytes: 1024 ** 3 };

/* ------------------------------------------------------------------------ */
/* Contratos                                                                 */
/* ------------------------------------------------------------------------ */

/** `kind` e `status` são chaves de `contracts.kind.*` e `contracts.status.*`. */
export type DemoContract = {
  id: string;
  title: string;
  kind: "sale" | "rent";
  counterparty: string;
  status: "draft" | "shared" | "awaiting_signature" | "signed" | "completed";
  hoursAgo: number;
};

export const DEMO_OWNER_CONTRACTS: DemoContract[] = [
  {
    id: "k1",
    title: "Arrendamento · T1 Lisboa",
    kind: "rent",
    counterparty: "Sofia Lima",
    status: "awaiting_signature",
    hoursAgo: 5,
  },
  {
    id: "k2",
    title: "Compra e venda · Moradia T4 Braga",
    kind: "sale",
    counterparty: "Ana Dias",
    status: "signed",
    hoursAgo: 48,
  },
  {
    id: "k3",
    title: "Arrendamento · Estúdio Coimbra",
    kind: "rent",
    counterparty: "",
    status: "draft",
    hoursAgo: 120,
  },
];

export const DEMO_BUYER_CONTRACTS: DemoContract[] = [
  {
    id: "k1",
    title: "Arrendamento · T1 Lisboa",
    kind: "rent",
    counterparty: "Marta Oliveira",
    status: "awaiting_signature",
    hoursAgo: 5,
  },
];

/* ------------------------------------------------------------------------ */
/* Os meus reports                                                           */
/* ------------------------------------------------------------------------ */

/**
 * Um relato de problema. O título e o "o que foi corrigido" são chaves de
 * `site.demo.reports` — são frases, e quem reportou lê-as no seu idioma.
 * `status` é o vocabulário de `TicketStatus`, que a timeline traduz em passos.
 */
export type DemoReport = {
  id: string;
  ref: string;
  titleKey: string;
  status: "new" | "triage" | "in_progress" | "awaiting_confirmation" | "closed";
  daysAgo: number;
  fixNoteKey?: string;
};

export const DEMO_REPORTS: DemoReport[] = [
  { id: "r1", ref: "UPM-2041", titleKey: "photoUpload", status: "in_progress", daysAgo: 3 },
  {
    id: "r2",
    ref: "UPM-1987",
    titleKey: "calendarTimezone",
    status: "closed",
    daysAgo: 16,
    fixNoteKey: "calendarTimezoneFix",
  },
];

/* ------------------------------------------------------------------------ */
/* Plano e faturas                                                           */
/* ------------------------------------------------------------------------ */

/**
 * Um medidor de "Utilização do plano". O rótulo é a chave de `plan.limits.*`;
 * `limit` a `null` é "ilimitado".
 */
export type DemoUsage = { id: string; used: number; limit: number | null };

export const DEMO_OWNER_USAGE: DemoUsage[] = [
  { id: "active_properties", used: 3, limit: 5 },
  { id: "visits", used: 7, limit: 30 },
  { id: "active_chats", used: 3, limit: 15 },
  { id: "cloud_gb", used: 4, limit: 5 },
];

export const DEMO_BUYER_USAGE: DemoUsage[] = [
  { id: "saved", used: 8, limit: 25 },
  { id: "alerts", used: 2, limit: 5 },
  { id: "active_chats", used: 3, limit: 10 },
  { id: "cloud_gb", used: 1, limit: 1 },
];

/** `status` é a chave de `plan.invoiceStatus.*`. */
export type DemoInvoice = {
  id: string;
  number: string;
  cents: number;
  daysAgo: number;
  status: "paid" | "open";
};

export const DEMO_INVOICES: DemoInvoice[] = [
  { id: "i1", number: "2026-0104", cents: 1_990, daysAgo: 6, status: "paid" },
  { id: "i2", number: "2026-0071", cents: 1_990, daysAgo: 36, status: "paid" },
  { id: "i3", number: "2026-0043", cents: 1_990, daysAgo: 66, status: "paid" },
];

/* ------------------------------------------------------------------------ */
/* Definições                                                                */
/* ------------------------------------------------------------------------ */

/**
 * Uma linha das preferências de notificação. O `id` é a chave de
 * `notifications.type.*` — as mesmas oito do ecrã verdadeiro.
 */
export type DemoNotificationPref = { id: string; inapp: boolean; email: boolean };

export const DEMO_OWNER_PREFS: DemoNotificationPref[] = [
  { id: "message", inapp: true, email: true },
  { id: "visit_request", inapp: true, email: true },
  { id: "visit_update", inapp: true, email: false },
  { id: "document_shared", inapp: true, email: false },
  { id: "ticket_update", inapp: true, email: true },
  { id: "invoice", inapp: false, email: true },
];

export const DEMO_BUYER_PREFS: DemoNotificationPref[] = [
  { id: "message", inapp: true, email: true },
  { id: "visit_update", inapp: true, email: true },
  { id: "price_drop", inapp: true, email: false },
  { id: "search_alert", inapp: true, email: true },
  { id: "document_shared", inapp: true, email: false },
  { id: "ticket_update", inapp: true, email: false },
];
