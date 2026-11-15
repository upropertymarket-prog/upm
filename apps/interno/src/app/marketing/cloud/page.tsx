import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { createClient } from "@upm/db/server";
import { CloudScreen } from "@upm/cloud";

import { InternalChrome } from "../../../components/InternalChrome";
import { getMarketingShellData } from "../../../lib/marketing-shell";
import { loadStaffCloud } from "../../../lib/staff-cloud";
import {
  apagarFicheiro,
  carregarFicheiro,
  criarPasta,
  reporFicheiro,
  urlDeDescarga,
} from "../../actions/staff-cloud";
import { setLocalePreference } from "../../actions/preferences";

/**
 * `/marketing/cloud` — a Cloud interna, pela porta do Marketing (P10-10 · D71)
 * =========================================================================
 * Uma das três portas da mesma gaveta; a nota de topo está em `/suporte/cloud`,
 * e é onde a decisão está escrita — incluindo a lista das capacidades que esta
 * Cloud não passa ao `CloudScreen`, e porquê. A terceira é `/admin/cloud`.
 *
 * Esta rota é a razão por que `20261015180000` existe: até lá, as políticas de
 * `folders` e `files` para `scope = 'staff'` diziam `is_staff()`, que por
 * decisão de 07 §24.6 **não** inclui o marketing — esta página abriria vazia, e
 * a de `/suporte/cloud` ao lado cheia, sobre as mesmas linhas.
 */

export const dynamic = "force-dynamic";

export default async function MarketingCloudPage() {
  const supabase = createClient(await cookies());
  const t = await getTranslations();

  const [cloud, shell] = await Promise.all([
    loadStaffCloud(supabase),
    getMarketingShellData(supabase, t("sidebar.groups.marketing"), t("sidebar.groups.admin")),
  ]);

  return (
    <InternalChrome
      role={shell.role}
      userName={shell.userName}
      userMeta={shell.userMeta}
      activeId="internalCloud"
      locale={shell.locale}
      onLocaleChange={setLocalePreference}
      counters={shell.counters}
    >
      <CloudScreen
        title={t("internalCloud.title")}
        subtitle={t("internalCloud.subtitle")}
        status={cloud.status}
        folders={cloud.folders}
        files={cloud.files}
        canNestFolders={false}
        onCreateFolder={criarPasta}
        onUpload={carregarFicheiro}
        onDelete={apagarFicheiro}
        onRestore={reporFicheiro}
        onDownloadUrl={urlDeDescarga}
      />
    </InternalChrome>
  );
}
