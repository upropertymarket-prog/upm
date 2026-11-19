"use client";

/**
 * Narração de canvas — App shell (04 §5.5)
 * =========================================================================
 * O shell é idêntico nos cinco perfis; o que muda é a lista de navegação
 * (07 §4.1–§4.3) e a etiqueta de grupo. Cada storyboard monta o chrome
 * verdadeiro de cada app (19 nov 2026):
 *  - Admin, Suporte e Marketing pelo `InternalChrome` do `interno`;
 *  - Proprietário e Comprador pelo `AppChrome` da `app`.
 *
 * Os menus vêm de `navigation.ts` e os textos de `pt.json`: se um menu mudar
 * na app, muda aqui sem tocar neste ficheiro. O conteúdo da página fica só pelo
 * `PageHeader` — o assunto destas molduras é o shell, não a página.
 *
 * Moldura de 1440 × 900, como as outras storyboards. O tema fica num invólucro
 * `data-theme`, que vence por proximidade na cascata; o `ThemeProvider` fica
 * pelo contexto de que o `ThemeToggle` da topbar precisa.
 */
import { NextIntlClientProvider } from "next-intl";

import "../../_estilos/shell-no-canvas.css";
import { Button } from "../../../../packages/ui/src/components/Button";
import { PageHeader } from "../../../../packages/ui/src/shell/PageHeader";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import { ToastProvider } from "../../../../packages/ui/src/components/Toast";
import { InternalChrome } from "../../../../apps/interno/src/components/InternalChrome";
import { AppChrome } from "../../../../apps/app/src/components/AppChrome";
import ptMessages from "../../../../packages/config/messages/pt.json";
import { NoNavigation } from "../../canvases/06 - proprietario/NoNavigation";

type Theme = "light" | "dark";

const NOTIFICATIONS = [
  { id: "n1", text: "João Costa pediu uma visita ao UPM-1041", when: "há 2 h", read: false },
  { id: "n2", text: "O UPM-1047 foi aprovado pela moderação", when: "ontem", read: true },
];

const noop = async () => undefined;

/** Invólucro comum: tema, traduções, toasts e travão de navegação. */
function Frame({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  return (
    <div data-theme={theme} style={{ height: "900px", background: "var(--bg)" }}>
      <NoNavigation>
        <NextIntlClientProvider locale="pt" messages={ptMessages}>
          <ThemeProvider initialChoice={theme}>
            <ToastProvider>{children}</ToastProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </NoNavigation>
    </div>
  );
}

function AdminDemo({ theme }: { theme: Theme }) {
  return (
    <Frame theme={theme}>
      <InternalChrome
        role="admin"
        userName="Helena Matos"
        userMeta="Administração · IT"
        activeId="dashboard"
        locale="pt"
        onLocaleChange={noop}
        counters={{ mailbox: 5, propertyModeration: 4, siteLeads: 12 }}
        notifications={NOTIFICATIONS}
      >
        <PageHeader
          title="Boa tarde, Helena"
          subtitle="Estado da plataforma"
          actions={
            <>
              <Button variant="secondary">Exportar</Button>
              <Button>Moderar imóveis</Button>
            </>
          }
        />
      </InternalChrome>
    </Frame>
  );
}

function SuporteDemo({ theme }: { theme: Theme }) {
  return (
    <Frame theme={theme}>
      <InternalChrome
        role="support"
        userName="Rita Sousa"
        userMeta="Suporte · Apoio ao cliente"
        activeId="tickets"
        locale="pt"
        onLocaleChange={noop}
        counters={{ mailbox: 3, tickets: 6 }}
        notifications={NOTIFICATIONS}
      >
        <PageHeader title="Tickets" subtitle="Pedidos de ajuda dos clientes" />
      </InternalChrome>
    </Frame>
  );
}

function MarketingDemo({ theme }: { theme: Theme }) {
  return (
    <Frame theme={theme}>
      <InternalChrome
        role="marketing"
        userName="Marta Nunes"
        userMeta="Marketing · Comunicação"
        activeId="campaigns"
        locale="pt"
        onLocaleChange={noop}
        notifications={NOTIFICATIONS}
      >
        <PageHeader
          title="Campanhas"
          subtitle="E-mails para clientes e pré-inscritos"
          actions={<Button>Nova campanha</Button>}
        />
      </InternalChrome>
    </Frame>
  );
}

function ProprietarioDemo({ theme }: { theme: Theme }) {
  return (
    <Frame theme={theme}>
      <AppChrome
        role="owner"
        userName="Ana Silva"
        userMeta="Proprietária · Premium"
        activeId="dashboard"
        locale="pt"
        onLocaleChange={noop}
        counters={{ leads: 9, messages: 3, visitSchedule: 3, contracts: 1 }}
        notifications={NOTIFICATIONS}
        liveNotifications={false}
        appUpdates={false}
      >
        <PageHeader
          title="Boa tarde, Ana"
          subtitle="Resumo da sua atividade e ativos"
          actions={
            <>
              <Button variant="secondary">Exportar</Button>
              <Button>Nova propriedade</Button>
            </>
          }
        />
      </AppChrome>
    </Frame>
  );
}

function CompradorDemo({ theme }: { theme: Theme }) {
  return (
    <Frame theme={theme}>
      <AppChrome
        role="buyer"
        userName="João Costa"
        userMeta="Comprador · Smarter"
        activeId="dashboard"
        locale="pt"
        onLocaleChange={noop}
        counters={{ saved: 4, messages: 3, myRequests: 2 }}
        notifications={NOTIFICATIONS}
        liveNotifications={false}
        appUpdates={false}
      >
        <PageHeader
          title="Bom dia, João"
          subtitle="Resumo da sua atividade"
          actions={<Button>Criar alerta</Button>}
        />
      </AppChrome>
    </Frame>
  );
}

export function AdminClaro() {
  return <AdminDemo theme="light" />;
}

export function AdminEscuro() {
  return <AdminDemo theme="dark" />;
}

export function SuporteClaro() {
  return <SuporteDemo theme="light" />;
}

export function SuporteEscuro() {
  return <SuporteDemo theme="dark" />;
}

export function MarketingClaro() {
  return <MarketingDemo theme="light" />;
}

export function MarketingEscuro() {
  return <MarketingDemo theme="dark" />;
}

export function ProprietarioClaro() {
  return <ProprietarioDemo theme="light" />;
}

export function ProprietarioEscuro() {
  return <ProprietarioDemo theme="dark" />;
}

export function CompradorClaro() {
  return <CompradorDemo theme="light" />;
}

export function CompradorEscuro() {
  return <CompradorDemo theme="dark" />;
}
