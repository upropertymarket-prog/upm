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
  Search,
  Settings,
  Signature,
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
 *  - `/admin/seo` tinha saído da v1 por 07 §2.1 ("o SEO edita-se nas Route
 *    Storyboards, por rota") e **voltou por 07 §24.5**, a 7 out 2026. A razão
 *    da volta não contradiz a da saída: as storyboards escrevem o `seo.ts`, que
 *    é a fonte versionada e continua a ser onde o SEO nasce — mas escrever o
 *    ficheiro exige um deploy, e o marketing precisa de corrigir um título em
 *    produção sem esperar por um. `seo_pages` é a sobreposição para esse caso,
 *    e esta página é onde se edita.
 *
 * **O SEO vai ter duas portas, não duas cópias** (decisão de 13 out 2026):
 * quando existir a dashboard do departamento de **Marketing**, a gestão e o
 * controlo de SEO têm de estar também lá — é o marketing quem corrige um título
 * em produção, e obrigá-lo a entrar pelo Admin é obrigá-lo a passar por um
 * painel que não é o dele. O que **não** se faz é um segundo editor: a entrada
 * de menu do Marketing aponta ao mesmo `SeoManager` e às mesmas server actions
 * de `/admin/seo`, com a mesma verificação de papel do lado do servidor. Dois
 * editores da mesma tabela divergem à primeira alteração.
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
  { id: "seo", titleKey: "seo", href: "/admin/seo", icon: Search },
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
  /**
   * **Assinaturas de e-mail, não subscrições.** Esta entrada nasceu com o id
   * `subscriptions`, a etiqueta inglesa "Subscriptions" e um ícone de cartão de
   * crédito — e aponta para `/suporte/assinaturas`, que é o editor de
   * assinaturas de P10-06. A ambiguidade é do português: "assinaturas" são as
   * duas coisas, e em inglês não são nenhuma vez a mesma. Corrigido ao
   * construir o ecrã (P10-06): o id e a chave passam a `signatures` e o ícone
   * passa a ser o da assinatura. As subscrições vivem em `/admin/planos` e no
   * `/plano` do cliente, e nunca tiveram nada que fazer no menu do Suporte.
   */
  { id: "signatures", titleKey: "signatures", href: "/suporte/assinaturas", icon: Signature },
];

export function navFor(role: "admin" | "support"): {
  entries: NavEntry[];
  groupKey: "admin" | "support";
} {
  return role === "admin"
    ? { entries: ADMIN_NAV, groupKey: "admin" }
    : { entries: SUPPORT_NAV, groupKey: "support" };
}
