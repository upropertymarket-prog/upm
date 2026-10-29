import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import { ToastProvider } from "../../../../packages/ui/src/components/Toast";
import { InternalChrome } from "../../../../apps/interno/src/components/InternalChrome";
import "../../_estilos/shell-no-canvas.css";
import { UpdatesManager } from "../../../../apps/interno/src/app/marketing/atualizacoes/UpdatesManager";
import ptMessages from "../../../../packages/config/messages/pt.json";
import { UPDATE_REACH, UPDATE_ROWS } from "../../_fixtures/marketing";

/**
 * Atualizações — `/marketing/atualizacoes` (P10-07 · 04 §2.6 e §8.1.3)
 * =========================================================================
 * A primeira entrada do `MARKETING_NAV`, e a tarefa que faz a área nascer. É o
 * `UpdatesManager` verdadeiro, com o `InternalChrome` em volta: o invólucro
 * fino das storyboards do Admin e do Suporte. O que entra por prop são os
 * dados (`../../_fixtures/marketing`) e ações que não escrevem.
 *
 * **Nenhuma storyboard publica nada.** Publicar uma atualização mostra um
 * modal a todos os clientes da audiência escolhida (`app_update_views` →
 * `AppUpdatesGate`): um clique numa maqueta não pode fazer isso. Os botões
 * aparecem porque são parte do ecrã que se está a revê — e devolvem `{}`.
 *
 * ## Porque são dois estados, e não um
 *
 * - **Com rascunho aberto** — o par lista + editor de 04 §2.6, que é a razão
 *   de este ecrã não ser um modal: escreve-se uma novidade a olhar para as
 *   anteriores, que é o que dá o tom.
 * - **Lista vazia** — o primeiro dia da área. O `EmptyState` tem de convidar a
 *   escrever a primeira, não parecer que a lista falhou a carregar.
 *
 * As três linhas são de propósito uma publicada, uma agendada e um rascunho:
 * são os três estados que o `StatusTag` distingue, e com todas no mesmo não se
 * via se a distinção existe.
 */

/** Ver a nota de topo: nada escreve, e nada notifica ninguém. */
const semEscrita = async () => ({});

function AtualizacoesDemo({
  theme,
  updates,
}: {
  theme: "light" | "dark";
  updates: typeof UPDATE_ROWS;
}) {
  return (
    <div data-theme={theme} style={{ minHeight: "1000px", background: "var(--bg)" }}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <ThemeProvider initialChoice={theme}>
          <ToastProvider>
            <InternalChrome
              role="marketing"
              userName="Marta Nunes"
              userMeta="Marketing · Comunicação"
              activeId="updates"
              locale="pt"
              onLocaleChange={async () => undefined}
            >
              <UpdatesManager
                updates={updates}
                reach={UPDATE_REACH}
                locale="pt"
                onSave={semEscrita}
                onPublish={semEscrita}
                onArchive={semEscrita}
                onDelete={semEscrita}
                onUploadImage={semEscrita}
              />
            </InternalChrome>
          </ToastProvider>
        </ThemeProvider>
      </NextIntlClientProvider>
    </div>
  );
}

export function MarketingAtualizacoesClaro() {
  return <AtualizacoesDemo theme="light" updates={UPDATE_ROWS} />;
}

export function MarketingAtualizacoesEscuro() {
  return <AtualizacoesDemo theme="dark" updates={UPDATE_ROWS} />;
}

/** O primeiro dia da área: ainda não há nenhuma novidade escrita. */
export function MarketingAtualizacoesVazio() {
  return <AtualizacoesDemo theme="light" updates={[]} />;
}

export function MarketingAtualizacoesVazioEscuro() {
  return <AtualizacoesDemo theme="dark" updates={[]} />;
}
