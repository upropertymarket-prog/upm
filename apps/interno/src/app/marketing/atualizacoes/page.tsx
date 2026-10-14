import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { createClient } from "@upm/db/server";
import { appUpdateReach, listAppUpdates } from "@upm/db/updates";

import { InternalChrome } from "../../../components/InternalChrome";
import { getMarketingShellData } from "../../../lib/marketing-shell";
import { setLocalePreference } from "../../actions/preferences";
import { archiveUpdate, publishUpdate, removeUpdate, saveUpdate } from "./actions";
import { UpdatesManager } from "./UpdatesManager";

/**
 * `/marketing/atualizacoes` — as novidades das apps (P10-07 · 04 §2.6)
 * =========================================================================
 * **A primeira rota da área `/marketing`**, que até hoje não existia. É esta
 * tarefa que faz a área nascer: o valor `marketing` de `user_role`, o
 * `is_marketing()`, o `MARKETING_NAV` e a entrada no middleware entram todos
 * com ela, e não antes — abrir um papel antes de haver ecrã é criar uma conta
 * que entra e não vê nada (07 §24.6).
 *
 * Sem estado no URL, ao contrário dos tickets e da caixa de e-mail: uma
 * novidade em preparação não é uma coisa que se passe a um colega por link, e a
 * lista tem poucas linhas. Quando houver razão, há dado para a pôr no URL.
 */

export const dynamic = "force-dynamic";

export default async function MarketingUpdatesPage() {
  const supabase = createClient(await cookies());
  const t = await getTranslations();

  const [updates, reach, shell] = await Promise.all([
    listAppUpdates(supabase),
    appUpdateReach(supabase),
    getMarketingShellData(supabase, t("sidebar.groups.marketing")),
  ]);

  return (
    <InternalChrome
      role="marketing"
      userName={shell.userName}
      userMeta={shell.userMeta}
      activeId="updates"
      locale={shell.locale}
      onLocaleChange={setLocalePreference}
      counters={shell.counters}
    >
      <UpdatesManager
        updates={updates}
        reach={reach}
        locale={shell.locale}
        onSave={saveUpdate}
        onPublish={publishUpdate}
        onArchive={archiveUpdate}
        onDelete={removeUpdate}
      />
    </InternalChrome>
  );
}
