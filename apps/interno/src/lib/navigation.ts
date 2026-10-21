import type { ComponentType } from "react";
import {
  BarChart3,
  Building2,
  CreditCard,
  FileSignature,
  FileText,
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

/**
 * 07 §4.1 — Suporte. Abre na Caixa de e-mail (03 §1.3).
 *
 * **Três entradas saíram daqui a 14 out 2026** (P10-07): Atualizações,
 * Campanhas e Métricas de e-mail foram para o `MARKETING_NAV`, por decisão do
 * cliente de 13 out (07 §24.6). O que fica é o que é apoio ao cliente: o
 * correio, os tickets, as assinaturas e a Cloud interna. Nenhum ID de tarefa se
 * renumerou — mudou a rota e o menu onde o ecrã nasce, não o que a tarefa
 * entrega.
 */
export const SUPPORT_NAV: NavEntry[] = [
  { id: "mailbox", titleKey: "mailbox", href: "/suporte/email", icon: Inbox, counter: true },
  { id: "tickets", titleKey: "tickets", href: "/suporte/tickets", icon: LifeBuoy, counter: true },
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

/**
 * 07 §24.6 — Marketing. Abre nas Atualizações, que é a primeira tarefa da área
 * (P10-07) e a que a faz nascer.
 *
 * **O SEO tem aqui a sua segunda porta, não uma segunda cópia** (07 §24.5 e
 * §24.6): é o marketing quem corrige um título em produção, e obrigá-lo a
 * entrar pelo painel do Admin é obrigá-lo a passar por um painel que não é o
 * dele. A entrada aponta ao mesmo `SeoManager` e às mesmas server actions de
 * `/admin/seo`, com a verificação de papel do lado do servidor. Dois editores
 * da mesma tabela divergem à primeira alteração.
 *
 * A Cloud interna aparece nas duas áreas pela mesma razão: é a mesma
 * `cloud_scope = 'staff'` da Fase 6, não uma segunda Cloud.
 */
export const MARKETING_NAV: NavEntry[] = [
  { id: "updates", titleKey: "updates", href: "/marketing/atualizacoes", icon: Sparkles },
  { id: "campaigns", titleKey: "campaigns", href: "/marketing/campanhas", icon: Megaphone },
  /**
   * **Modelos de e-mail** (21 out 2026), e o lugar tem razão de ser.
   *
   * Entra **depois das Campanhas e antes das Métricas**, porque é aí que cabe
   * na leitura que o menu já faz de cima para baixo: as Atualizações e as
   * Campanhas são o que se diz **a um público**; os Modelos são o que se diz
   * **a uma pessoa**; as Métricas medem o que saiu. Pô-los no fim separava-os
   * das Campanhas, que é o vizinho de que estão mais perto — os dois são texto
   * que o Marketing escreve para sair por e-mail.
   *
   * Não vai para o `SUPPORT_NAV`, apesar de ser o Suporte quem mais os usa: o
   * Suporte **usa-os no compositor**, não os escreve. Quem escreve é esta área,
   * e o menu diz quem é dono de quê.
   */
  { id: "templates", titleKey: "templates", href: "/marketing/modelos", icon: FileText },
  { id: "emailMetrics", titleKey: "emailMetrics", href: "/marketing/metricas", icon: BarChart3 },
  { id: "seo", titleKey: "seo", href: "/marketing/seo", icon: Search },
  { id: "internalCloud", titleKey: "internalCloud", href: "/marketing/cloud", icon: Cloud },
];

export type InternalRole = "admin" | "support" | "marketing";

export function navFor(role: InternalRole): {
  entries: NavEntry[];
  groupKey: InternalRole;
} {
  if (role === "admin") return { entries: ADMIN_NAV, groupKey: "admin" };
  if (role === "marketing") return { entries: MARKETING_NAV, groupKey: "marketing" };
  return { entries: SUPPORT_NAV, groupKey: "support" };
}
