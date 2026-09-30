import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import { ToastProvider } from "../../../../packages/ui/src/components/Toast";
import { PageHeader } from "../../../../packages/ui/src/shell/PageHeader";

import { AppChrome } from "../../../../apps/app/src/components/AppChrome";
import { MessagesScreen } from "../../../../apps/app/src/components/messages/MessagesScreen";
import { VisitsScreen } from "../../../../apps/app/src/components/visits/VisitsScreen";
import { LeadsScreen } from "../../../../apps/app/src/components/leads/LeadsScreen";
import ptMessages from "../../../../packages/config/messages/pt.json";
import {
  demoConversation,
  demoConversations,
  demoLeads,
  demoLocaleChange,
  demoNotifications,
  demoOk,
  demoVisits,
} from "./demo";

/**
 * Ecrãs da Fase 5 — Mensagens, Agenda de visitas e Leads.
 *
 * Os componentes são os mesmos que as rotas `/mensagens`, `/agenda` e `/leads`
 * usam: recebem dados e ações por prop, e é isso que permite montá-los aqui com
 * dados fixos, sem sessão nem servidor (o mesmo contrato do Painel).
 *
 * As ações devolvem `{}` — no canvas não há nada para escrever. O toast de
 * confirmação aparece na mesma, que é o comportamento que se quer ver.
 *
 * O mês do calendário é fixo (`2026-09`): `currentMonth()` lê o relógio e faria
 * a storyboard mudar de forma todos os meses.
 */
function Shell({
  theme,
  activeId,
  title,
  subtitle,
  children,
}: {
  theme: "light" | "dark";
  activeId: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div data-theme={theme} style={{ background: "var(--bg)", height: "900px" }}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <ThemeProvider initialChoice={theme}>
          <ToastProvider>
            <AppChrome
              role="owner"
              userName="Ana Silva"
              userMeta="Proprietária · Premium"
              activeId={activeId}
              locale="pt"
              onLocaleChange={demoLocaleChange}
              counters={{ leads: 2, messages: 3, visitSchedule: 2, contracts: 1 }}
              notifications={demoNotifications}
              liveNotifications={false}
            >
              <PageHeader title={title} subtitle={subtitle} />
              {children}
            </AppChrome>
          </ToastProvider>
        </ThemeProvider>
      </NextIntlClientProvider>
    </div>
  );
}

export default function Mensagens() {
  return (
    <Shell
      theme="light"
      activeId="messages"
      title="Mensagens"
      subtitle="Conversas por imóvel, sem partilhar contactos"
    >
      <MessagesScreen
        conversations={demoConversations}
        active={demoConversation}
        onSend={demoOk}
        onShareAddress={demoOk}
        onSelect={() => undefined}
      />
    </Shell>
  );
}

export function Agenda() {
  return (
    <Shell
      theme="light"
      activeId="visitSchedule"
      title="Agenda de visitas"
      subtitle="Gira as visitas agendadas para os seus imóveis"
    >
      <VisitsScreen
        rows={demoVisits}
        role="owner"
        month="2026-09"
        onAccept={demoOk}
        onReschedule={demoOk}
        onCancel={demoOk}
        onArchive={demoOk}
      />
    </Shell>
  );
}

export function Leads() {
  return (
    <Shell theme="light" activeId="leads" title="Leads" subtitle="4 contactos nos últimos 30 dias">
      <LeadsScreen rows={demoLeads} onUpdateStage={demoOk} />
    </Shell>
  );
}
