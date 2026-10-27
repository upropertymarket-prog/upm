import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { createClient } from "@upm/db/server";
import { CloudScreen } from "@upm/cloud";

import { InternalChrome } from "../../../components/InternalChrome";
import { getAdminShellData } from "../../../lib/admin-shell";
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
 * `/admin/cloud` — a terceira porta da Cloud interna (26 out 2026)
 * =========================================================================
 * O Admin tinha a permissão e não tinha porta. `is_internal()` são três papéis
 * — admin, suporte e marketing — e as políticas de `folders` e `files` para
 * `scope = 'staff'` usam-no desde `20261015180000`: o Admin **sempre** pôde ler
 * e escrever nesta gaveta. O que não havia era entrada de menu nem rota. Quem
 * administra a plataforma chegava aos ficheiros da equipa escrevendo
 * `/suporte/cloud` à mão, por um menu que não é o dele.
 *
 * Pedido do cliente, a 26 out 2026: **toda a gente com acesso interno tem esta
 * Cloud**, e sem custo — o custo é da empresa. Esta rota é a parte do pedido
 * que faltava no produto; a parte da base de dados já estava feita.
 *
 * ## Uma porta, não uma cópia
 *
 * É o mesmo desenho de `/admin/email` e de `/marketing/seo`: importa o
 * `CloudScreen` de `@upm/cloud` e as **mesmas** server actions de
 * `../../actions/staff-cloud` — os mesmos, não equivalentes. O que muda é o que
 * se vê em volta: o papel, o grupo da barra lateral e os contadores. Três
 * Clouds sobre a mesma tabela divergiam à primeira alteração, e duas delas
 * ficavam sem a correção que a terceira levou.
 *
 * ## Zero diferenças de capacidade
 *
 * Ao contrário de `/admin/email`, que deliberadamente não passa o
 * `onCreateTicket`, aqui **não há nada a tirar**. A gaveta é da equipa toda e o
 * Admin não é mais nem menos dono dela do que o Suporte: as mesmas props que
 * `/suporte/cloud` passa, pela mesma razão. Ver a nota de topo dessa página
 * para o que o ecrã não recebe — partilhas, versões e substituir — e porquê.
 */

export const dynamic = "force-dynamic";

export default async function AdminCloudPage() {
  const supabase = createClient(await cookies());
  const [t, cloud, shell] = await Promise.all([
    getTranslations(),
    loadStaffCloud(supabase),
    getAdminShellData(supabase),
  ]);

  return (
    <InternalChrome
      role="admin"
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
