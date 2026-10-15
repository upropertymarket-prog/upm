import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { createClient } from "@upm/db/server";
import { countEmailEvents, listCampaigns } from "@upm/db/campaigns";

import { InternalChrome } from "../../../components/InternalChrome";
import { getMarketingShellData } from "../../../lib/marketing-shell";
import { setLocalePreference } from "../../actions/preferences";
import { descarregarRelatorio, guardarRelatorioNaCloud } from "./actions";
import { MetricsView } from "./MetricsView";

/**
 * `/marketing/metricas` — as métricas de e-mail (P10-10 · 04 §2.6)
 * =========================================================================
 * A terceira rota da área `/marketing` e a última peça da Fase 10 do lado do
 * Marketing. Só pôde nascer depois de P10-09: os contadores de `campaigns`
 * existiam desde `20261015090000`, mas estavam todos a zero — era
 * `record_email_event()` que faltava para os encher.
 *
 * A contagem de recibos é lida aqui e passada ao ecrã por uma razão só:
 * distinguir "ninguém abriu" de "ainda não chegou nenhum recibo", que é o que
 * acontece enquanto o webhook do Resend não estiver apontado. Sem ela, a
 * página mostrava zeros honestos que se liam como um resultado.
 */

export const dynamic = "force-dynamic";

export default async function MarketingMetricsPage() {
  const supabase = createClient(await cookies());
  const t = await getTranslations();

  const [campaigns, shell, receipts] = await Promise.all([
    listCampaigns(supabase),
    getMarketingShellData(supabase, t("sidebar.groups.marketing")),
    countEmailEvents(supabase),
  ]);

  return (
    <InternalChrome
      role="marketing"
      userName={shell.userName}
      userMeta={shell.userMeta}
      activeId="emailMetrics"
      locale={shell.locale}
      onLocaleChange={setLocalePreference}
      counters={shell.counters}
    >
      <MetricsView
        campaigns={campaigns}
        receiptCount={receipts}
        locale={shell.locale}
        onDownload={descarregarRelatorio}
        onSaveToCloud={guardarRelatorioNaCloud}
      />
    </InternalChrome>
  );
}
