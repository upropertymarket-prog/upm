import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { createClient } from "@upm/db/server";

import { InternalChrome } from "../../../components/InternalChrome";
import { StaffCloud } from "../../../components/StaffCloud";
import { listStaffFiles, listStaffFolders } from "../../../lib/staff-cloud";
import { getSupportShellData } from "../../../lib/support-shell";
import {
  apagarFicheiro,
  carregarFicheiro,
  criarPasta,
  reporFicheiro,
  urlDeDescarga,
} from "../../actions/staff-cloud";
import { setLocalePreference } from "../../actions/preferences";

/**
 * `/suporte/cloud` — a Cloud interna, pela porta do Suporte (P10-10)
 * =========================================================================
 * **Uma das duas portas para a mesma gaveta.** A outra é `/marketing/cloud`, e
 * as duas montam o mesmo `StaffCloud` sobre as mesmas linhas
 * (`scope = 'staff'`). A única diferença entre os dois ficheiros é o `role` que
 * o `InternalChrome` recebe, que é o que desenha o menu certo à esquerda.
 *
 * É a figura que 07 §24.5 fixou para o SEO — duas portas, um editor — e a
 * razão é a mesma: quem trabalha no Suporte não devia ter de entrar pelo painel
 * do Marketing para chegar aos ficheiros da equipa, nem o contrário.
 */

export const dynamic = "force-dynamic";

export default async function SupportCloudPage() {
  const supabase = createClient(await cookies());
  const t = await getTranslations();

  const [folders, files, shell] = await Promise.all([
    listStaffFolders(supabase),
    listStaffFiles(supabase),
    getSupportShellData(supabase, t("sidebar.groups.support")),
  ]);

  return (
    <InternalChrome
      role="support"
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
