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

import type { NavGroup, SidebarLabels, SidebarUser } from "../shell/Sidebar";
import type { Notification, TopbarLabels } from "../shell/Topbar";

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
 * ("um módulo de fixtures estático — `packages/ui/src/demo-data`"), e a razão é
 * boa: os tipos são os dos componentes que alimenta (`NavGroup`, `SidebarUser`,
 * `Notification`), por isso uma alteração à forma de qualquer um deles parte
 * aqui, no compilador, em vez de partir no site em produção.
 *
 * **As pessoas e os números são inventados, os ecrãs não.** A ordem dos menus é
 * a de 05 §1.2, à letra e na mesma ordem — é o que faz um visitante reconhecer
 * o produto quando entrar nele a sério. Suporte não entra: 05 §1.1 diz
 * "demonstração com as UIs reais de Proprietário e Comprador (sem Suporte)".
 */

/** Sem navegação: na demo os itens do menu desenham-se, não levam a lado nenhum. */
const NAV_ICON = { size: 18, "aria-hidden": true } as const;

export const DEMO_OWNER_NAV: NavGroup[] = [
  {
    label: "Gerir",
    items: [
      { id: "painel", label: "Painel", href: "#", icon: <LayoutDashboard {...NAV_ICON} /> },
      { id: "market", label: "Market", href: "#", icon: <Store {...NAV_ICON} /> },
      {
        id: "propriedades",
        label: "As minhas propriedades",
        href: "#",
        icon: <Building2 {...NAV_ICON} />,
        count: 3,
      },
      { id: "leads", label: "Leads", href: "#", icon: <Users {...NAV_ICON} />, count: 5 },
      {
        id: "mensagens",
        label: "Mensagens",
        href: "#",
        icon: <MessagesSquare {...NAV_ICON} />,
        count: 2,
      },
      { id: "agenda", label: "Agenda de visitas", href: "#", icon: <CalendarDays {...NAV_ICON} /> },
      { id: "mapa", label: "Mapa", href: "#", icon: <Map {...NAV_ICON} /> },
      { id: "cloud", label: "Cloud", href: "#", icon: <Cloud {...NAV_ICON} /> },
      { id: "contratos", label: "Contratos", href: "#", icon: <FileSignature {...NAV_ICON} /> },
      { id: "reports", label: "Os meus reports", href: "#", icon: <Bug {...NAV_ICON} /> },
      { id: "plano", label: "Plano", href: "#", icon: <CreditCard {...NAV_ICON} /> },
      { id: "definicoes", label: "Definições", href: "#", icon: <Settings {...NAV_ICON} /> },
    ],
  },
];

export const DEMO_BUYER_NAV: NavGroup[] = [
  {
    label: "Procurar",
    items: [
      { id: "painel", label: "Painel", href: "#", icon: <LayoutDashboard {...NAV_ICON} /> },
      { id: "market", label: "Market", href: "#", icon: <Store {...NAV_ICON} /> },
      {
        id: "mensagens",
        label: "Mensagens",
        href: "#",
        icon: <MessagesSquare {...NAV_ICON} />,
        count: 1,
      },
      {
        id: "pedidos",
        label: "Pedidos de visitas",
        href: "#",
        icon: <CalendarCheck {...NAV_ICON} />,
      },
      { id: "guardados", label: "Guardados", href: "#", icon: <Heart {...NAV_ICON} />, count: 8 },
      { id: "mapa", label: "Mapa", href: "#", icon: <Map {...NAV_ICON} /> },
      { id: "cloud", label: "Cloud", href: "#", icon: <Cloud {...NAV_ICON} /> },
      { id: "contratos", label: "Contratos", href: "#", icon: <FileSignature {...NAV_ICON} /> },
      { id: "reports", label: "Os meus reports", href: "#", icon: <Bug {...NAV_ICON} /> },
      { id: "plano", label: "Plano", href: "#", icon: <CreditCard {...NAV_ICON} /> },
      { id: "definicoes", label: "Definições", href: "#", icon: <Settings {...NAV_ICON} /> },
    ],
  },
];

export const DEMO_OWNER_USER: SidebarUser = {
  name: "Marta Oliveira",
  meta: "Proprietária · Smarter",
  initials: "MO",
  online: true,
};

export const DEMO_BUYER_USER: SidebarUser = {
  name: "Rui Pereira",
  meta: "Comprador · Smarter",
  initials: "RP",
  online: true,
};

export const DEMO_SIDEBAR_LABELS: SidebarLabels = {
  collapse: "Recolher",
  expand: "Expandir",
  report: "Reportar problema",
  signOut: "Terminar sessão",
  countSuffix: "por ver",
};

export const DEMO_TOPBAR_LABELS: TopbarLabels = {
  search: "Pesquisar",
  openMenu: "Abrir menu",
  language: "Idioma",
  notifications: "Notificações",
  markAllRead: "Marcar todas como lidas",
  noNotifications: "Sem notificações",
  theme: { title: "Tema", light: "Claro", dark: "Escuro", system: "Sistema" },
};

/** O seletor de idioma da topbar desenha-se; na demo não troca nada. */
export const DEMO_LOCALES = [
  { value: "pt", label: "Português" },
  { value: "en", label: "English" },
];

export const DEMO_OWNER_NOTIFICATIONS: Notification[] = [
  { id: "n1", text: "Novo pedido de visita para o T2 no Porto", when: "há 12 min", read: false },
  { id: "n2", text: "Rui Pereira respondeu à sua mensagem", when: "há 1 h", read: false },
  { id: "n3", text: "O anúncio da Moradia T4 foi aprovado", when: "ontem", read: true },
];

export const DEMO_BUYER_NOTIFICATIONS: Notification[] = [
  { id: "n1", text: "Desceu o preço de um imóvel que guardou", when: "há 30 min", read: false },
  { id: "n2", text: "A visita de quinta-feira foi confirmada", when: "há 3 h", read: true },
];

/** Os quatro KPI do Painel do Proprietário (04 §8.4). */
export type DemoKpi = { id: string; label: string; value: string; hint: string };

export const DEMO_OWNER_KPIS: DemoKpi[] = [
  { id: "views", label: "Visualizações", value: "1 284", hint: "+18% esta semana" },
  { id: "leads", label: "Leads novas", value: "5", hint: "2 por responder" },
  { id: "visits", label: "Visitas agendadas", value: "3", hint: "a próxima é quinta" },
  { id: "active", label: "Propriedades ativas", value: "3", hint: "de 5 do plano" },
];

/** Linhas da tabela "Últimas leads" do Painel. */
export type DemoLead = {
  id: string;
  name: string;
  property: string;
  when: string;
  state: "new" | "answered" | "scheduled";
};

export const DEMO_OWNER_LEADS: DemoLead[] = [
  {
    id: "l1",
    name: "Rui Pereira",
    property: "T2 com varanda · Porto",
    when: "há 12 min",
    state: "new",
  },
  {
    id: "l2",
    name: "Ana Dias",
    property: "Moradia T4 · Braga",
    when: "há 2 h",
    state: "answered",
  },
  {
    id: "l3",
    name: "Pedro Nunes",
    property: "T2 com varanda · Porto",
    when: "ontem",
    state: "scheduled",
  },
];

/** Cartões do Market do Comprador. Sem `coverUrl`: não há fotografias no projeto. */
export type DemoListing = {
  id: string;
  title: string;
  city: string;
  typology: string;
  area: number;
  price: string;
  deal: "sale" | "rent";
  saved: boolean;
};

export const DEMO_BUYER_LISTINGS: DemoListing[] = [
  {
    id: "p1",
    title: "Apartamento T2 com varanda",
    city: "Porto",
    typology: "T2",
    area: 88,
    price: "245 000 €",
    deal: "sale",
    saved: true,
  },
  {
    id: "p2",
    title: "Moradia T4 com jardim",
    city: "Braga",
    typology: "T4",
    area: 210,
    price: "390 000 €",
    deal: "sale",
    saved: false,
  },
  {
    id: "p3",
    title: "T1 mobilado junto ao metro",
    city: "Lisboa",
    typology: "T1",
    area: 46,
    price: "950 € / mês",
    deal: "rent",
    saved: true,
  },
  {
    id: "p4",
    title: "Estúdio remodelado",
    city: "Coimbra",
    typology: "T0",
    area: 32,
    price: "580 € / mês",
    deal: "rent",
    saved: false,
  },
];
