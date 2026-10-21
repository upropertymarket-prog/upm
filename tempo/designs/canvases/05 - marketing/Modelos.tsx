import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import { ToastProvider } from "../../../../packages/ui/src/components/Toast";
import { InternalChrome } from "../../../../apps/interno/src/components/InternalChrome";
import { TemplateManager } from "../../../../apps/interno/src/app/marketing/modelos/TemplateManager";
import ptMessages from "../../../../packages/config/messages/pt.json";
import { TEMPLATE_ROWS } from "../../_fixtures/marketing";

/**
 * Modelos de e-mail — `/marketing/modelos` (21 out 2026)
 * =========================================================================
 * A terceira entrada do `MARKETING_NAV`, entre as Campanhas e as Métricas. É o
 * `TemplateManager` verdadeiro, com o `InternalChrome` em volta — o mesmo
 * invólucro das outras storyboards da área. O que entra por prop são os dados
 * (`../../_fixtures/marketing`) e ações que não escrevem.
 *
 * ## `data-upm-overlay-root`, e porque é que esta storyboard precisa dele
 *
 * O painel de edição é um `Drawer`, e o `Overlay` que o monta procura
 * `[data-upm-overlay-root]` — **caindo no `document.body` quando não o
 * encontra**. Na aplicação isso é o comportamento certo: o `body` está dentro
 * do `<html>` onde o `ThemeProvider` escreve o `data-theme`, logo herda-o.
 *
 * Numa storyboard não: o tema vive na `<div>` abaixo, e um painel que vá ao
 * `body` fica **fora** dela — aparece claro dentro de uma moldura escura. Foi
 * exatamente isso que aconteceu no canvas do Admin e levou tempo a explicar.
 * Declarar a raiz aqui prende o painel a esta árvore, e com ele o tema.
 *
 * ## Porque são dois estados, e não um
 *
 * - **A lista** — quatro modelos em categorias diferentes, um deles inativo. É
 *   o ecrã a que alguém chega para escolher, e o que ele tem de distinguir à
 *   primeira vista é a categoria e se o modelo está em circulação.
 * - **Lista vazia** — o primeiro dia. O `EmptyState` tem de explicar o que é um
 *   modelo, não parecer que a lista falhou a carregar.
 *
 * O painel de edição não é um terceiro estado porque **abre-se por clique**: o
 * `Drawer` não tem prop que o abra de fora, e inventar uma só para a maqueta
 * era mudar o componente de produção por causa da storyboard. Vê-se no canvas,
 * carregando em Editar — e é para isso que a raiz de overlay acima existe.
 */

/** Ver a nota de topo: nada escreve. O `id` devolvido é o que o ecrã espera. */
const semEscrita = async () => ({ ok: true, id: "tpl-demo" });

function ModelosDemo({
  theme,
  templates,
}: {
  theme: "light" | "dark";
  templates: typeof TEMPLATE_ROWS;
}) {
  return (
    <div
      data-theme={theme}
      data-upm-overlay-root
      style={{ minHeight: "900px", background: "var(--bg)", position: "relative" }}
    >
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <ThemeProvider initialChoice={theme}>
          <ToastProvider>
            <InternalChrome
              role="marketing"
              userName="Helena Matos"
              userMeta="Marketing"
              activeId="templates"
              locale="pt"
              onLocaleChange={async () => undefined}
              counters={{}}
            >
              <TemplateManager
                templates={templates}
                canWrite
                locale="pt"
                onSave={semEscrita}
                onDelete={semEscrita}
              />
            </InternalChrome>
          </ToastProvider>
        </ThemeProvider>
      </NextIntlClientProvider>
    </div>
  );
}

export function MarketingModelosClaro() {
  return <ModelosDemo theme="light" templates={TEMPLATE_ROWS} />;
}

export function MarketingModelosEscuro() {
  return <ModelosDemo theme="dark" templates={TEMPLATE_ROWS} />;
}

/** O primeiro dia: o Marketing ainda não escreveu modelo nenhum. */
export function MarketingModelosVazio() {
  return <ModelosDemo theme="light" templates={[]} />;
}

export function MarketingModelosVazioEscuro() {
  return <ModelosDemo theme="dark" templates={[]} />;
}
