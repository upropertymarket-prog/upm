import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { createClient } from "@upm/db/server";
import { CloudScreen } from "@upm/cloud";

import { InternalChrome } from "../../../components/InternalChrome";
import { loadStaffCloud } from "../../../lib/staff-cloud";
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
 * `/suporte/cloud` — a Cloud interna, pela porta do Suporte (P10-10 · D71)
 * =========================================================================
 * **Uma das três portas para a mesma gaveta.** As outras são `/marketing/cloud`
 * e `/admin/cloud`, e as três montam o mesmo ecrã sobre as mesmas linhas
 * (`scope = 'staff'`). A única diferença entre os três ficheiros é o `role` que
 * o `InternalChrome` recebe, que é o que desenha o menu certo à esquerda.
 *
 * São três porque `is_internal()` são três papéis — admin, suporte e
 * marketing — e **quem tem acesso interno tem esta Cloud**, sem custo: o custo
 * é da empresa (decisão de 26 out 2026). O Admin esteve nesse predicado desde
 * `20261015180000` e não tinha entrada de menu nenhuma; tinha a permissão e
 * não tinha porta, que é a pior das duas combinações.
 *
 * É a figura que 07 §24.5 fixou para o SEO — duas portas, um editor — e a
 * razão é a mesma: quem trabalha no Suporte não devia ter de entrar pelo painel
 * do Marketing para chegar aos ficheiros da equipa, nem o contrário.
 *
 * ## O ecrã é o `CloudScreen`, o mesmo de `/cloud` (D71, 26 out 2026)
 *
 * Havia aqui um `StaffCloud` próprio — uma tabela, sem coluna de pastas, sem
 * gaveta de detalhe, com outro cabeçalho. A razão era que o `CloudScreen` não
 * usava `next-intl`, e um ecrã monolingue não entra num painel com seletor de
 * idioma. D72 traduziu-o a 19 out e o motivo caiu; ficavam duas Clouds a
 * divergir sobre a mesma tabela.
 *
 * O que **não** se passa a este ecrã é o que esta Cloud não tem, e cada
 * ausência tem uma razão:
 *
 * - **`onShare`**: aqui toda a equipa já tem acesso; `scope = 'staff'` **é** a
 *   partilha. Um botão de partilhar só podia significar "para fora", que é
 *   outra funcionalidade e com outras perguntas (expira? leva código?).
 * - **`onLoadDetails`/`onReplace`**: versões e acessos ficam de fora enquanto a
 *   base de dados os der só ao dono — `file_versions_select_via_file` ainda diz
 *   `is_staff()`, `file_access_log` exige `owner_id = auth.uid()` ou
 *   `is_admin()`, e `cloud_add_file_version` recusa quem não é o dono *e* cobra
 *   a quota dele. Abri-los é uma migração com decisões próprias, não um botão.
 *
 * Em troca, esta Cloud tem o que a do cliente não tem: `onRestore`, porque a
 * reciclagem da equipa repõe ficheiro a ficheiro.
 *
 * O cartão de armazenamento **mostra-se**, com o tecto de exemplo de
 * `STAFF_CLOUD_LIMIT_BYTES` — que ninguém impõe e que se sobe numa linha. A
 * razão de não ser "ilimitado" é a mais simples: uma equipa que não vê o que
 * está a ocupar não sabe quando pedir mais.
 */

export const dynamic = "force-dynamic";

export default async function SupportCloudPage() {
  const supabase = createClient(await cookies());
  const t = await getTranslations();

  const [cloud, shell] = await Promise.all([
    loadStaffCloud(supabase),
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
