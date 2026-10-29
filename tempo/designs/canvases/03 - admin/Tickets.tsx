import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import { ToastProvider } from "../../../../packages/ui/src/components/Toast";
import { InternalChrome } from "../../../../apps/interno/src/components/InternalChrome";
import "../../_estilos/shell-no-canvas.css";
import { TicketsManager } from "../../../../apps/interno/src/app/suporte/tickets/TicketsManager";
import ptMessages from "../../../../packages/config/messages/pt.json";
import { TICKET_COUNTS, TICKET_DETAIL, TICKET_HISTORY, TICKET_ROWS } from "../../_fixtures/tickets";

/**
 * Tickets no Admin — `/admin/tickets`, só leitura (P10-02 · 07 §5.10)
 * =========================================================================
 * **É o mesmo `TicketsManager` do Suporte, com `readOnly`** — e é essa a coisa
 * que esta storyboard existe para mostrar. Ao lado das storyboards de
 * `canvases/suporte`, com os mesmos dados do mesmo ficheiro de fixtures, a
 * diferença entre os dois ecrãs fica visível de uma vez: o Admin tem
 * visibilidade global e **nenhum** controlo de workflow.
 *
 * O que desaparece no `readOnly` são o `Select` de estado, a nota "O que foi
 * corrigido" e o `Guardar e notificar`. Desaparece mesmo, não fica desativado:
 * um botão cinzento convida a perguntar porquê, e a resposta seria "nunca vai
 * funcionar para si" (07 §5.10). `Copiar p/ agente` fica — é leitura.
 *
 * É também por isto que não há uma segunda cópia dos dados: se esta storyboard
 * tivesse fixtures próprias, a comparação com a do Suporte deixava de valer no
 * dia em que uma das cópias mudasse.
 */

function AdminTicketsDemo({ theme }: { theme: "light" | "dark" }) {
  return (
    <div data-theme={theme} style={{ minHeight: "900px", background: "var(--bg)" }}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <ThemeProvider initialChoice={theme}>
          <ToastProvider>
            <InternalChrome
              role="admin"
              userName="Helena Matos"
              userMeta="Administração · IT"
              activeId="tickets"
              locale="pt"
              onLocaleChange={async () => undefined}
              counters={{ propertyModeration: 4, siteLeads: 12 }}
            >
              <TicketsManager
                rows={TICKET_ROWS}
                counts={TICKET_COUNTS}
                tab="pending"
                search=""
                selected={TICKET_DETAIL}
                history={TICKET_HISTORY}
                readOnly
              />
            </InternalChrome>
          </ToastProvider>
        </ThemeProvider>
      </NextIntlClientProvider>
    </div>
  );
}

export function AdminTicketsClaro() {
  return <AdminTicketsDemo theme="light" />;
}

export function AdminTicketsEscuro() {
  return <AdminTicketsDemo theme="dark" />;
}
