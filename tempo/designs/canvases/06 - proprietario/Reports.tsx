"use client";

import { NextIntlClientProvider, useTranslations } from "next-intl";
import { NoNavigation } from "./NoNavigation";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import { ToastProvider } from "../../../../packages/ui/src/components/Toast";
import { ReportProblemModal } from "../../../../packages/ui/src/support/ReportProblemModal";
import { reportProblemLabels } from "../../../../packages/ui/src/support/labels";
import { AppChrome } from "../../../../apps/app/src/components/AppChrome";
import "../../_estilos/shell-no-canvas.css";
import { ReportsTimeline } from "../../../../apps/app/src/app/reports/ReportsTimeline";
import ptMessages from "../../../../packages/config/messages/pt.json";
import { MY_REPORTS } from "../../_fixtures/tickets";
import { demoLocaleChange, demoNotifications } from "./demo";

/**
 * O Suporte visto de dentro da app (P10-01 · P10-02)
 * =========================================================================
 * Duas coisas que o perfil do Proprietário ganhou na Fase 10, e que fechavam a
 * nota "falta Os meus reports" do canvas:
 *
 *  1. **`/reports`** — a timeline de quem reportou (04 §2.7 #6 · 07 §5.11), com
 *     os cinco passos em linguagem simples. Entra entre Contratos e Plano, que
 *     é a posição de `myReports` em `OWNER_NAV`.
 *  2. **O modal Reportar problema** — o botão do rodapé da sidebar, que existia
 *     desde a Fase 1 sem fazer nada. Como a Confirmação de PIN no canvas do
 *     Admin, aparece por cima de um ecrã real: um modal fora de contexto não
 *     mostra o que importa, que é o véu e o que fica legível por baixo.
 *
 * **Os dois lados do mesmo ticket, no mesmo canvas que o Suporte.** Os dados
 * vêm de `../../_fixtures/tickets`, o mesmo ficheiro das storyboards de
 * `canvases/suporte` — o que o Suporte lê como `in_progress` lê-se aqui como "A
 * corrigir". É propositado: os dois vocabulários têm de poder comparar-se.
 *
 * `onSubmit` devolve sempre a confirmação e **não submete nada**: a ação real
 * (`submitProblemReport`) cria um ticket e notifica o Suporte. Uma maqueta não
 * abre bilhetes de trabalho a ninguém.
 */

const semEnvio = async () => ({ ref: "AGXZ-NKGE", merged: false });

function MeusReportsConteudo() {
  return (
    <AppChrome
      role="owner"
      userName="Ana Silva"
      userMeta="Proprietária · Premium"
      activeId="myReports"
      locale="pt"
      onLocaleChange={demoLocaleChange}
      counters={{ leads: 9, messages: 3, visitSchedule: 3, contracts: 1 }}
      notifications={demoNotifications}
      liveNotifications={false}
      appUpdates={false}
    >
      <ReportsTimeline reports={MY_REPORTS} locale="pt" />
    </AppChrome>
  );
}

function MeusReportsDemo({ theme }: { theme: "light" | "dark" }) {
  return (
    <div data-theme={theme} style={{ background: "var(--bg)", height: "900px" }}>
      <NoNavigation>
        <NextIntlClientProvider locale="pt" messages={ptMessages}>
          <ThemeProvider initialChoice={theme}>
            <ToastProvider>
              <MeusReportsConteudo />
            </ToastProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </NoNavigation>
    </div>
  );
}

export function MeusReportsClaro() {
  return <MeusReportsDemo theme="light" />;
}

export function MeusReportsEscuro() {
  return <MeusReportsDemo theme="dark" />;
}

/**
 * O modal por cima de `/reports`: é de lá que se reporta um problema novo
 * depois de ver que o anterior já está a ser corrigido.
 */
function ReportarProblemaConteudo() {
  const t = useTranslations();
  return (
    <ReportProblemModal
      open
      onClose={() => undefined}
      onSubmit={semEnvio}
      labels={reportProblemLabels(t)}
    />
  );
}

function ReportarProblemaDemo({ theme }: { theme: "light" | "dark" }) {
  return (
    // `data-upm-overlay-root`: o modal nasce aqui dentro em vez de ir ao `body`
    // — ver a nota de `usePortalTarget` em `packages/ui`.
    <div
      data-theme={theme}
      data-upm-overlay-root
      style={{ background: "var(--bg)", height: "900px" }}
    >
      <NoNavigation>
        <NextIntlClientProvider locale="pt" messages={ptMessages}>
          <ThemeProvider initialChoice={theme}>
            <ToastProvider>
              <MeusReportsConteudo />
              <ReportarProblemaConteudo />
            </ToastProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </NoNavigation>
    </div>
  );
}

export function ReportarProblemaClaro() {
  return <ReportarProblemaDemo theme="light" />;
}

export function ReportarProblemaEscuro() {
  return <ReportarProblemaDemo theme="dark" />;
}
