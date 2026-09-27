import type { ComponentType } from "react";
import {
  Bookmark,
  Building2,
  CalendarDays,
  Cloud,
  CreditCard,
  FileSignature,
  LayoutDashboard,
  LifeBuoy,
  Map,
  MessageSquare,
  Settings,
  Store,
  Users,
} from "lucide-react";

/**
 * Navegação do comprador e do proprietário (07 §4.2 · 07 §4.3)
 * =========================================================================
 * A ordem é a de **07 §4.2/§4.3**, que substitui a de 03 §1.2 onde divergem —
 * 07 ganha sobre 01–06 (07, cabeçalho). Concretamente: no comprador, 03 tinha
 * "Mensagens, Pedidos de visitas, Guardados" e 07 fixou "Guardados, Mensagens,
 * Mapa, Meus pedidos".
 *
 * Rotas de 03 §1.2, com a renomeação de 07 §4.2:
 * `/pedidos-de-visita` → `/meus-pedidos`.
 *
 * `titleKey` aponta para `nav.*` em `packages/config/messages` — nenhuma
 * etiqueta é escrita em código (P1-06).
 */

export type NavEntry = {
  id: string;
  /** Chave em `nav.*`. */
  titleKey: string;
  href: string;
  icon: ComponentType<{ size?: number | string }>;
  /** Item com contador laranja de novos/não lidos/pendentes (07 §4.2). */
  counter?: boolean;
};

/** Comuns aos dois perfis — 03 §1.2. */
const DASHBOARD: NavEntry = {
  id: "dashboard",
  titleKey: "dashboard",
  href: "/painel",
  icon: LayoutDashboard,
};
const MARKET: NavEntry = { id: "market", titleKey: "market", href: "/market", icon: Store };
const MESSAGES: NavEntry = {
  id: "messages",
  titleKey: "messages",
  href: "/mensagens",
  icon: MessageSquare,
  counter: true,
};
const MAP: NavEntry = { id: "map", titleKey: "map", href: "/mapa", icon: Map };
const CLOUD: NavEntry = { id: "cloud", titleKey: "cloud", href: "/cloud", icon: Cloud };
const CONTRACTS: NavEntry = {
  id: "contracts",
  titleKey: "contracts",
  href: "/contratos",
  icon: FileSignature,
  counter: true,
};
const REPORTS: NavEntry = {
  id: "myReports",
  titleKey: "myReports",
  href: "/reports",
  icon: LifeBuoy,
};
const PLAN: NavEntry = { id: "plan", titleKey: "plan", href: "/plano", icon: CreditCard };
const SETTINGS: NavEntry = {
  id: "settings",
  titleKey: "settings",
  href: "/definicoes",
  icon: Settings,
};

/** 07 §4.2 — etiqueta de grupo "Procurar" (03 §1.2). */
export const BUYER_NAV: NavEntry[] = [
  DASHBOARD,
  MARKET,
  { id: "saved", titleKey: "saved", href: "/guardados", icon: Bookmark, counter: true },
  MESSAGES,
  MAP,
  {
    id: "myRequests",
    titleKey: "myRequests",
    href: "/meus-pedidos",
    icon: CalendarDays,
    counter: true,
  },
  CLOUD,
  CONTRACTS,
  REPORTS,
  PLAN,
  SETTINGS,
];

/** 07 §4.3 — etiqueta de grupo "Gerir" (03 §1.2). */
export const OWNER_NAV: NavEntry[] = [
  DASHBOARD,
  MARKET,
  {
    id: "myProperties",
    titleKey: "myProperties",
    href: "/propriedades",
    icon: Building2,
  },
  { id: "leads", titleKey: "leads", href: "/leads", icon: Users, counter: true },
  MESSAGES,
  {
    id: "visitSchedule",
    titleKey: "visitSchedule",
    href: "/agenda",
    icon: CalendarDays,
    counter: true,
  },
  MAP,
  CLOUD,
  CONTRACTS,
  REPORTS,
  PLAN,
  SETTINGS,
];

/** `buyer` e `owner` são os dois papéis que vivem em `app.*` (07 §4.1). */
export function navFor(role: "buyer" | "owner"): {
  entries: NavEntry[];
  groupKey: "search" | "manage";
} {
  return role === "owner"
    ? { entries: OWNER_NAV, groupKey: "manage" }
    : { entries: BUYER_NAV, groupKey: "search" };
}
