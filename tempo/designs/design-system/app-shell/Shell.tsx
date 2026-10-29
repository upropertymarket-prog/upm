"use client";

/**
 * Narração de canvas — App shell (04 §5.5)
 * =========================================================================
 * O ponto destes storyboards é uma coisa só: **o shell é idêntico nos 4
 * perfis**. O que muda é a lista de navegação (07 §4.1–§4.3) e a etiqueta de
 * grupo. Por isso o Proprietário e o Admin aparecem lado a lado.
 *
 * Cada storyboard corre no seu próprio iframe, logo o `ThemeProvider` pode fixar
 * o tema de cada um sem afetar os outros.
 */
import { createElement } from "react";
import {
  Bookmark,
  Building2,
  CalendarDays,
  Cloud,
  CreditCard,
  FileSignature,
  LayoutDashboard,
  Mail,
  Map,
  MessageSquare,
  Settings,
  Store,
  TrendingUp,
  Users,
} from "lucide-react";

import { AppShell } from "../../../../packages/ui/src/shell/AppShell";
import "../../_estilos/shell-no-canvas.css";
import { Brand } from "../../../../packages/ui/src/shell/Brand";
import { Button } from "../../../../packages/ui/src/components/Button";
import { Card, CardBody, CardHeader, CardTitle } from "../../../../packages/ui/src/components/Card";
import { PageHeader } from "../../../../packages/ui/src/shell/PageHeader";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import type { NavItem } from "../../../../packages/ui/src/shell/Sidebar";
import { Note, Row, ThemePair } from "../../_narration/ThemePair";

const LABELS = {
  collapse: "Colapsar menu",
  expand: "Expandir menu",
  report: "Reportar problema",
  signOut: "Sair",
  countSuffix: "por ler",
};

const TOPBAR_LABELS = {
  search: "Pesquisar",
  openMenu: "Abrir menu",
  language: "Idioma",
  notifications: "Notificações",
  markAllRead: "Marcar como lidas",
  noNotifications: "Sem notificações",
  theme: { title: "Tema", light: "Claro", dark: "Escuro", system: "Sistema" },
};

const LOCALES = [
  { value: "pt", label: "Português" },
  { value: "en", label: "English" },
];

/**
 * O tipo do ícone é o dos ícones do `lucide-react` — um componente que aceita
 * `size`. Estava como `Parameters<typeof createElement>[0]`, que aceita
 * qualquer coisa e por isso recusava o `size` que esta função passa: o
 * `createElement` genérico não sabe que props é que o componente tem.
 */
type IconComponent = (props: { size?: number }) => React.ReactNode;

function item(
  id: string,
  label: string,
  href: string,
  icon: IconComponent,
  count?: number,
): NavItem {
  return { id, label, href, icon: createElement(icon, { size: 17 }), count };
}

/** 07 §4.3 — menu do proprietário, na ordem definitiva. */
const OWNER_NAV: NavItem[] = [
  item("dashboard", "Painel", "/painel", LayoutDashboard),
  item("market", "Market", "/market", Store),
  item("properties", "As minhas propriedades", "/propriedades", Building2),
  item("leads", "Leads", "/leads", Users, 9),
  item("messages", "Mensagens", "/mensagens", MessageSquare, 3),
  item("visits", "Agenda de visitas", "/agenda", CalendarDays, 3),
  item("map", "Mapa", "/mapa", Map),
  item("cloud", "Cloud", "/cloud", Cloud),
  item("contracts", "Contratos", "/contratos", FileSignature, 1),
  item("plan", "Plano", "/plano", CreditCard),
  item("settings", "Definições", "/definicoes", Settings),
];

/** 07 §4.2 — menu do comprador, para comparar com o do proprietário. */
const BUYER_NAV: NavItem[] = [
  item("dashboard", "Painel", "/painel", LayoutDashboard),
  item("market", "Market", "/market", Store),
  item("saved", "Guardados", "/guardados", Bookmark, 4),
  item("messages", "Mensagens", "/mensagens", MessageSquare, 3),
  item("map", "Mapa", "/mapa", Map),
  item("requests", "Meus pedidos", "/meus-pedidos", CalendarDays, 2),
  item("cloud", "Cloud", "/cloud", Cloud),
  item("contracts", "Contratos", "/contratos", FileSignature),
  item("plan", "Plano", "/plano", CreditCard),
  item("settings", "Definições", "/definicoes", Settings),
];

/** 07 §4.1 — menu do admin. Note `/admin/tickets`, só de leitura (07 §5.10). */
const ADMIN_NAV: NavItem[] = [
  item("dashboard", "Painel", "/admin/painel", LayoutDashboard),
  item("users", "Utilizadores", "/admin/utilizadores", Users),
  item("moderation", "Moderação de imóveis", "/admin/imoveis", Building2, 4),
  item("traffic", "Tráfego do site", "/admin/trafego", TrendingUp),
  item("plans", "Planos", "/admin/planos", CreditCard),
  item("templates", "Templates de contrato", "/admin/contratos", FileSignature),
  item("leads", "Leads do site", "/admin/leads-site", Users, 12),
  item("mailboxes", "Caixas de e-mail", "/admin/caixas-email", Mail),
  item("settings", "Definições", "/admin/definicoes", Settings),
];

const NOTIFICATIONS = [
  { id: "n1", text: "João Costa pediu uma visita ao UPM-1041", when: "há 2 h", read: false },
  { id: "n2", text: "O UPM-1047 foi aprovado pela moderação", when: "ontem", read: true },
];

/**
 * Todos os storyboards de um canvas partilham o mesmo documento, logo o
 * `ThemeProvider` — que escreve `data-theme` na raiz — não serve para fixar o
 * tema de um storyboard: o último a montar ganhava para todos. O tema de cada
 * shell fica num invólucro `data-theme`, que vence por proximidade na cascata; o
 * provider fica só pelo contexto de que o `ThemeToggle` precisa.
 */
function Shell({
  theme,
  nav,
  group,
  user,
  meta,
  title,
  subtitle,
  primaryAction,
  collapsed = false,
  children,
}: {
  theme: "light" | "dark";
  nav: NavItem[];
  group: string;
  user: string;
  meta: string;
  title: string;
  subtitle: string;
  primaryAction: string;
  collapsed?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div data-theme={theme}>
      <AppShell
        defaultCollapsed={collapsed}
        sidebar={{
          groups: [{ label: group, items: nav }],
          activeId: "dashboard",
          user: {
            name: user,
            meta,
            initials: user
              .split(" ")
              .map((part) => part[0])
              .join(""),
            online: true,
          },
          onReport: () => undefined,
          onSignOut: () => undefined,
          labels: LABELS,
        }}
        topbar={{
          labels: TOPBAR_LABELS,
          locale: "pt",
          locales: LOCALES,
          onLocaleChange: () => undefined,
          notifications: NOTIFICATIONS,
          onMarkAllRead: () => undefined,
        }}
      >
        <PageHeader
          title={title}
          subtitle={subtitle}
          actions={
            <>
              <Button variant="secondary">Exportar</Button>
              <Button>{primaryAction}</Button>
            </>
          }
        />
        {children ?? (
          <Card padded>
            <span style={{ color: "var(--muted)" }}>
              O conteúdo da página entra aqui. O shell é o mesmo nos quatro perfis (04 §5.5).
            </span>
          </Card>
        )}
      </AppShell>
    </div>
  );
}

/** Proprietário, tema claro, sidebar a 256 px. */
export function Proprietario() {
  return (
    <ThemeProvider initialChoice="light">
      <Shell
        theme="light"
        nav={OWNER_NAV}
        group="Gerir"
        user="Ana Silva"
        meta="Proprietária · Premium"
        title="Boa tarde, Ana"
        subtitle="Resumo da sua atividade e ativos"
        primaryAction="Nova propriedade"
      />
    </ThemeProvider>
  );
}

/** Admin, tema escuro. Mesmo shell, outra lista (07 §4.1). */
export function Admin() {
  return (
    <ThemeProvider initialChoice="dark">
      <Shell
        theme="dark"
        nav={ADMIN_NAV}
        group="Administração"
        user="Helena Matos"
        meta="Administração · IT"
        title="Painel"
        subtitle="Estado da plataforma"
        primaryAction="Moderar imóveis"
      />
    </ThemeProvider>
  );
}

/** Comprador com a sidebar colapsada a 84 px — e o ícone da marca por entregar. */
export function Rail() {
  return (
    <ThemeProvider initialChoice="light">
      <Shell
        theme="light"
        nav={BUYER_NAV}
        group="Procurar"
        user="João Costa"
        meta="Comprador · Smarter"
        title="Bom dia, João"
        subtitle="Resumo da sua atividade"
        primaryAction="Criar alerta"
        collapsed
      >
        <Card>
          <CardHeader>
            <CardTitle>Ícone da marca — por entregar</CardTitle>
          </CardHeader>
          <CardBody>
            <span style={{ color: "var(--muted)" }}>
              No rail de 84 px o wordmark não cabe. 07 §10.1 diz que o ícone final vem do cliente e
              que, até lá, não se inventa nem se deriva um — por isso está ali um espaço reservado
              neutro, de borda tracejada, com o nome da marca em `aria-label`.
            </span>
          </CardBody>
        </Card>
      </Shell>
    </ThemeProvider>
  );
}

/** PageHeader e Brand isolados, nos dois temas. */
export function Cabecalho() {
  return (
    <ThemePair>
      <Row label="Brand · wordmark trocado por CSS, sem esperar por JS">
        <Brand />
        <Brand collapsed />
      </Row>
      <PageHeader
        title="As minhas propriedades"
        subtitle="Aqui pode gerir todo o seu portfólio"
        actions={
          <>
            <Button variant="secondary">Exportar</Button>
            <Button>Nova propriedade</Button>
          </>
        }
      />
      <Note>
        No Painel o título é a saudação («Bom dia, Ana»); nas restantes páginas é o título com
        subtítulo. As ações ficam à direita: Exportar mais a ação primária do contexto (04 §5.5). O
        quadrado tracejado ao lado do wordmark é o espaço reservado do ícone da marca (07 §10.1).
      </Note>
    </ThemePair>
  );
}
