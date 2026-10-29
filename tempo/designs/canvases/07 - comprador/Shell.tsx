import { NextIntlClientProvider } from "next-intl";
import { NoNavigation } from "../06 - proprietario/NoNavigation";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import { ToastProvider } from "../../../../packages/ui/src/components/Toast";
import { PageHeader } from "../../../../packages/ui/src/shell/PageHeader";

import { AppChrome } from "../../../../apps/app/src/components/AppChrome";
import "../../_estilos/shell-no-canvas.css";
import ptMessages from "../../../../packages/config/messages/pt.json";
import { demoLocaleChange, demoNotifications } from "./demo";

/**
 * O invólucro das storyboards do comprador.
 *
 * O canvas 06 repete este bloco em cada ficheiro; aqui ele vive num sítio só,
 * porque os quatro ecrãs do comprador o montam exatamente igual — muda o
 * `activeId` e o cabeçalho. O que está cá dentro é o mesmo: `role="buyer"`,
 * o João Costa, e as notificações fixas do `demo.ts`.
 *
 * O tema é fixado num `data-theme` próprio em vez de ser deixado ao
 * `ThemeProvider`: o provider lê o `data-theme-choice` do documento e o
 * `localStorage`, partilhados por todas as storyboards do mesmo host, e sem
 * isto bastava carregar no alternador da topbar para o par claro/escuro ficar
 * igual. O provider continua a envolver o conteúdo porque a topbar precisa do
 * contexto para o alternador existir; é só a cor que deixa de depender dele.
 *
 * `liveNotifications={false}` e `appUpdates={false}`: ambos abrem canais com o
 * Supabase, e no canvas não há sessão nenhuma.
 */
export function Shell({
  theme,
  activeId,
  title,
  subtitle,
  hideHeader = false,
  fill = false,
  children,
}: {
  theme: "light" | "dark";
  activeId: string;
  title: string;
  subtitle: string;
  hideHeader?: boolean;
  /** O mesmo `fill` que a rota usa — ver `AppShell`. */
  fill?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div data-theme={theme} style={{ background: "var(--bg)", height: "900px" }}>
      <NoNavigation>
        <NextIntlClientProvider locale="pt" messages={ptMessages}>
          <ThemeProvider initialChoice={theme}>
            <ToastProvider>
              <AppChrome
                role="buyer"
                userName="João Costa"
                userMeta="Comprador"
                activeId={activeId}
                locale="pt"
                onLocaleChange={demoLocaleChange}
                fill={fill}
                counters={{ saved: 3, messages: 2, myRequests: 1, contracts: 1 }}
                notifications={demoNotifications}
                liveNotifications={false}
                appUpdates={false}
              >
                {hideHeader ? null : <PageHeader title={title} subtitle={subtitle} />}
                {children}
              </AppChrome>
            </ToastProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </NoNavigation>
    </div>
  );
}
