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
  ShieldCheck,
  Settings,
  Signature,
  Sparkles,
  TrendingUp,
  UserPlus,
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

export type NavGroup = { labelKey: string; entries: NavEntry[] };

/**
 * 07 §4.1 — Admin, **em quatro grupos** (14 nov 2026, pedido do cliente).
 * =========================================================================
 * Uma lista corrida de treze entradas não dizia o que era gestão com o
 * cliente e o que era da casa. A ordem e o agrupamento são os do cliente; os
 * nomes dos grupos são nossos:
 *  - **Geral** — o dia a dia: painel, correio e Cloud;
 *  - **Gestão de clientes** — quem usa a app e o que publica ou assina;
 *  - **Site e negócio** — o site público e o que se vende nele;
 *  - **Equipa e sistema** — a casa por dentro.
 *
 * A **Equipa interna** entrou aqui no mesmo dia: a equipa saiu de
 * Utilizadores, que passou a ser só de clientes.
 */
export const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    labelKey: "adminGeneral",
    entries: [
      { id: "dashboard", titleKey: "dashboard", href: "/admin/painel", icon: LayoutDashboard },
      /**
       * **A caixa de e-mail do Admin** (26 out 2026), e entra *antes* da
       * Configuração de e-mail de propósito: lê-se "a caixa, e as caixas que a
       * servem". O Admin tinha a segunda sem a primeira — podia criar a caixa
       * `geral@` e ligar-lhe o IMAP, e não tinha onde ler o que lá caísse.
       *
       * É a mesma caixa do Suporte, pela mesma porta de código (ver
       * `/admin/email/page.tsx`), com uma ação de menos: criar um ticket a partir
       * de um e-mail continua a ser só do Suporte (07 §5.10).
       */
      { id: "mailbox", titleKey: "mailbox", href: "/admin/email", icon: Inbox, counter: true },
      /**
       * **A Cloud da equipa, pela terceira porta** (26 out 2026).
       *
       * O Admin tinha a permissão e não tinha entrada: `is_internal()` — o
       * predicado das políticas de `scope = 'staff'` desde `20261015180000` — são
       * admin, suporte e marketing, e só os dois últimos tinham linha de menu.
       * Decisão do cliente: quem tem acesso interno tem esta Cloud, sem custo, que
       * é da empresa. Aponta ao mesmo `CloudScreen` e às mesmas server actions de
       * `/suporte/cloud`, como o SEO e a caixa de e-mail já fazem.
       */
      { id: "internalCloud", titleKey: "internalCloud", href: "/admin/cloud", icon: Cloud },
    ],
  },
  {
    labelKey: "adminClients",
    entries: [
      { id: "users", titleKey: "users", href: "/admin/utilizadores", icon: Users },
      {
        id: "propertyModeration",
        titleKey: "propertyModeration",
        href: "/admin/imoveis",
        icon: Building2,
        counter: true,
      },
      {
        id: "contractTemplates",
        titleKey: "contractTemplates",
        href: "/admin/contratos",
        icon: FileSignature,
      },
    ],
  },
  {
    labelKey: "adminBusiness",
    entries: [
      { id: "siteTraffic", titleKey: "siteTraffic", href: "/admin/trafego", icon: TrendingUp },
      {
        id: "siteLeads",
        titleKey: "siteLeads",
        href: "/admin/leads-site",
        icon: UserPlus,
        counter: true,
      },
      { id: "seo", titleKey: "seo", href: "/admin/seo", icon: Search },
      { id: "plans", titleKey: "plans", href: "/admin/planos", icon: CreditCard },
    ],
  },
  /**
   * **O Marketing dentro do Admin** (14 nov 2026, pedido do cliente). As mesmas
   * rotas e ecrãs de `/marketing` — não cópias —, e o shell muda para o do
   * Admin quando é ele quem lá entra (`marketing-shell.ts`). O SEO e a Cloud
   * já tinham porta própria no Admin e ficam nos grupos onde estão.
   */
  {
    labelKey: "marketing",
    entries: [
      { id: "updates", titleKey: "updates", href: "/marketing/atualizacoes", icon: Sparkles },
      { id: "campaigns", titleKey: "campaigns", href: "/marketing/campanhas", icon: Megaphone },
      { id: "templates", titleKey: "templates", href: "/marketing/modelos", icon: FileText },
      {
        id: "emailMetrics",
        titleKey: "emailMetrics",
        href: "/marketing/metricas",
        icon: BarChart3,
      },
    ],
  },
  {
    labelKey: "adminTeam",
    entries: [
      // Só leitura (07 §5.10).
      { id: "tickets", titleKey: "tickets", href: "/admin/tickets", icon: LifeBuoy },
      { id: "team", titleKey: "team", href: "/admin/equipa", icon: ShieldCheck },
      { id: "mailboxes", titleKey: "mailboxes", href: "/admin/caixas-email", icon: Mail },
      { id: "settings", titleKey: "settings", href: "/admin/definicoes", icon: Settings },
    ],
  },
];

/** A mesma lista, corrida — para quem só precisa das rotas. */
export const ADMIN_NAV: NavEntry[] = ADMIN_NAV_GROUPS.flatMap((group) => group.entries);

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

/** Os grupos do menu de cada papel; o Suporte e o Marketing têm um só. */
export function navFor(role: InternalRole): NavGroup[] {
  if (role === "admin") return ADMIN_NAV_GROUPS;
  if (role === "marketing") return [{ labelKey: "marketing", entries: MARKETING_NAV }];
  return [{ labelKey: "support", entries: SUPPORT_NAV }];
}
