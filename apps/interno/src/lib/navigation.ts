import type { ComponentType } from "react";
import {
  BarChart3,
  Building2,
  CreditCard,
  FileSignature,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  Megaphone,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
  Cloud,
} from "lucide-react";

/**
 * Navegação do Admin e do Suporte (07 §4.1)
 * =========================================================================
 * Listas de 07 §4.1, rotas de 03 §1.3, com duas correções de 07:
 *  - `/admin/reports` → `/admin/tickets`, vista **só de leitura** (07 §5.10);
 *    o workflow de tickets é exclusivo do Suporte, em `/suporte/tickets`;
 *  - `/admin/seo` **não existe na v1** — a tabela `seo_pages` e a página de
 *    administração de SEO saíram (07 §2.1). O SEO edita-se nas Route
 *    Storyboards, por rota.
 *
 * Etiquetas de grupo: "Administração" e "Suporte" (04 §5.5).
 */

export type NavEntry = {
  id: string;
  titleKey: string;
  href: string;
  icon: ComponentType<{ size?: number | string }>;
  counter?: boolean;
};

/** 07 §4.1 — Admin. */
export const ADMIN_NAV: NavEntry[] = [
  { id: "dashboard", titleKey: "dashboard", href: "/admin/painel", icon: LayoutDashboard },
  { id: "users", titleKey: "users", href: "/admin/utilizadores", icon: Users },
  {
    id: "propertyModeration",
    titleKey: "propertyModeration",
    href: "/admin/imoveis",
    icon: Building2,
    counter: true,
  },
  { id: "siteTraffic", titleKey: "siteTraffic", href: "/admin/trafego", icon: TrendingUp },
  { id: "plans", titleKey: "plans", href: "/admin/planos", icon: CreditCard },
  {
    id: "contractTemplates",
    titleKey: "contractTemplates",
    href: "/admin/contratos",
    icon: FileSignature,
  },
  { id: "siteLeads", titleKey: "siteLeads", href: "/admin/leads-site", icon: Users, counter: true },
  // Só leitura (07 §5.10).
  { id: "tickets", titleKey: "tickets", href: "/admin/tickets", icon: LifeBuoy },
  { id: "mailboxes", titleKey: "mailboxes", href: "/admin/caixas-email", icon: Mail },
  { id: "settings", titleKey: "settings", href: "/admin/definicoes", icon: Settings },
];

/** 07 §4.1 — Suporte. Abre na Caixa de e-mail (03 §1.3). */
export const SUPPORT_NAV: NavEntry[] = [
  { id: "mailbox", titleKey: "mailbox", href: "/suporte/email", icon: Inbox, counter: true },
  { id: "tickets", titleKey: "tickets", href: "/suporte/tickets", icon: LifeBuoy, counter: true },
  { id: "updates", titleKey: "updates", href: "/suporte/atualizacoes", icon: Sparkles },
  { id: "campaigns", titleKey: "campaigns", href: "/suporte/campanhas", icon: Megaphone },
  { id: "emailMetrics", titleKey: "emailMetrics", href: "/suporte/metricas", icon: BarChart3 },
  { id: "internalCloud", titleKey: "internalCloud", href: "/suporte/cloud", icon: Cloud },
  {
    id: "subscriptions",
    titleKey: "subscriptions",
    href: "/suporte/assinaturas",
    icon: CreditCard,
  },
];

export function navFor(role: "admin" | "support"): {
  entries: NavEntry[];
  groupKey: "admin" | "support";
} {
  return role === "admin"
    ? { entries: ADMIN_NAV, groupKey: "admin" }
    : { entries: SUPPORT_NAV, groupKey: "support" };
}
