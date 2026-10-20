import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import { ToastProvider } from "../../../../packages/ui/src/components/Toast";
import { InternalChrome } from "../../../../apps/interno/src/components/InternalChrome";
import { MetricsView } from "../../../../apps/interno/src/app/marketing/metricas/MetricsView";
import ptMessages from "../../../../packages/config/messages/pt.json";
import { CAMPAIGN_ROWS } from "../../_fixtures/marketing";

/**
 * Métricas de e-mail — `/marketing/metricas` (P10-10 · 04 §2.6)
 * =========================================================================
 * Terceira entrada do `MARKETING_NAV`. É o `MetricsView` verdadeiro, com as
 * mesmas campanhas das storyboards das Campanhas — e é essa partilha que
 * importa: os números que aqui se leem são os da linha de `campaigns`, e duas
 * cópias dos dados dariam dois ecrãs a dizer coisas diferentes sobre o mesmo
 * envio.
 *
 * **O `receiptCount` é o que decide o ecrã**, e por isso são dois estados:
 *
 * - **Com recibos** — as percentagens de abertura e de clique calculam-se, e a
 *   tabela mostra o que uma campanha enviada produziu.
 * - **A zero** — é o estado real de hoje: o webhook do Resend ainda não está
 *   apontado (doc 09, confirmações de produção). O ecrã tem de dizer que os
 *   números estão a zero **porque o webhook não fala**, e não deixar ler zeros
 *   honestos como "ninguém abriu". Era a nota que E4.4 pediu para o doc 09, e é
 *   a razão de esta segunda moldura existir.
 *
 * Nada escreve: `onDownload` devolve `{}` em vez de um CSV — o ficheiro sai do
 * servidor — e `onSaveToCloud` não copia nada para a gaveta da equipa.
 */

const semEscrita = async () => ({});

function MetricasDemo({ theme, receiptCount }: { theme: "light" | "dark"; receiptCount: number }) {
  return (
    <div data-theme={theme} style={{ minHeight: "900px", background: "var(--bg)" }}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <ThemeProvider initialChoice={theme}>
          <ToastProvider>
            <InternalChrome
              role="marketing"
              userName="Marta Nunes"
              userMeta="Marketing · Comunicação"
              activeId="emailMetrics"
              locale="pt"
              onLocaleChange={async () => undefined}
            >
              <MetricsView
                campaigns={CAMPAIGN_ROWS}
                receiptCount={receiptCount}
                locale="pt"
                onDownload={semEscrita}
                onSaveToCloud={semEscrita}
              />
            </InternalChrome>
          </ToastProvider>
        </ThemeProvider>
      </NextIntlClientProvider>
    </div>
  );
}

export function MarketingMetricasClaro() {
  return <MetricasDemo theme="light" receiptCount={363} />;
}

export function MarketingMetricasEscuro() {
  return <MetricasDemo theme="dark" receiptCount={363} />;
}

/** O estado real de hoje: campanhas enviadas e zero recibos. */
export function MarketingMetricasSemRecibos() {
  return <MetricasDemo theme="light" receiptCount={0} />;
}

export function MarketingMetricasSemRecibosEscuro() {
  return <MetricasDemo theme="dark" receiptCount={0} />;
}
