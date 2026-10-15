import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { createClient } from "@upm/db/server";

import { InternalChrome } from "../../../components/InternalChrome";
import { StaffCloud } from "../../../components/StaffCloud";
import { getMarketingShellData } from "../../../lib/marketing-shell";
import { listStaffFiles, listStaffFolders } from "../../../lib/staff-cloud";
import {
  apagarFicheiro,
  carregarFicheiro,
  criarPasta,
  reporFicheiro,
  urlDeDescarga,
} from "../../actions/staff-cloud";
import { setLocalePreference } from "../../actions/preferences";

/**
 * `/marketing/cloud` — a Cloud interna, pela porta do Marketing (P10-10)
 * =========================================================================
 * A segunda porta da mesma gaveta; a primeira é `/suporte/cloud`. Ver a nota
 * de topo dessa, que é onde a decisão está escrita.
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

  const [folders, files, shell] = await Promise.all([
    listStaffFolders(supabase),
    listStaffFiles(supabase),
    getMarketingShellData(supabase, t("sidebar.groups.marketing")),
  ]);

  return (
    <InternalChrome
      role="marketing"
      userName={shell.userName}
      userMeta={shell.userMeta}
      activeId="internalCloud"
      locale={shell.locale}
      onLocaleChange={setLocalePreference}
      counters={shell.counters}
    >
      <StaffCloud
        folders={folders}
        files={files}
        locale={shell.locale}
        onUpload={carregarFicheiro}
        onCreateFolder={criarPasta}
        onDelete={apagarFicheiro}
        onRestore={reporFicheiro}
        onDownloadUrl={urlDeDescarga}
      />
    </InternalChrome>
  );
}
