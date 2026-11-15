import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { LOCALES, type Locale } from "@upm/config";
import { createClient } from "@upm/db/server";

import { InternalChrome } from "../../../components/InternalChrome";
import { getMarketingShellData } from "../../../lib/marketing-shell";
import { setLocalePreference } from "../../actions/preferences";
import { saveSeoPage } from "../../admin/seo/actions";
import { loadSeoRows } from "../../admin/seo/rows";
import { SeoManager } from "../../admin/seo/SeoManager";

/**
 * `/marketing/seo` — a segunda porta do SEO (07 §24.5 e §24.6 · P10-07)
 * =========================================================================
 * Esta entrada está no menu do Marketing desde P10-07 e **dava 404**: era a
 * única entrada de menu sem página. Fechar o 404 escondendo-a do menu era a
 * outra saída, e seria a errada — 07 §24.5 é explícito sobre quem faz este
 * trabalho: *"é o marketing quem corrige um título em produção"*, e obrigá-lo
 * a entrar pelo painel do Admin é obrigá-lo a passar por um painel que não é
 * o dele.
 *
 * ## Uma porta, não uma cópia
 *
 * O ficheiro é curto de propósito. Importa o `SeoManager`, o `saveSeoPage` e o
 * `loadSeoRows` de `/admin/seo` — os mesmos, não equivalentes. O que muda entre
 * as duas portas é só o que se vê em volta: o papel, o grupo da barra lateral e
 * os contadores. **Dois editores da mesma tabela divergem à primeira
 * alteração**, e o que estava a dois passos de acontecer era isso.
 *
 * Importar de `../../admin/` atravessa as áreas, e é a leitura certa: o dono do
 * editor é um só. Mudar o editor de sítio tornava-o de ninguém.
 *
 * ## O que foi preciso do lado de dentro
 *
 * Nada disto se vê a partir daqui, e por isso fica escrito: o ecrã sozinho não
 * chegava. `20261021120000_seo_marketing_door.sql` abriu os três sítios que
 * recusavam o marketing — `admin_save_seo_page` (que exigia `is_admin()`), o
 * `write_audit_log` (que exigia `is_staff()`, e `is_staff()` não inclui o
 * marketing, de propósito) e a leitura do `audit_log`, agora limitada às linhas
 * de `seo_pages` e a mais nada.
 *
 * `force-dynamic` pela mesma razão do painel do Admin: a lista muda a cada
 * gravação e não há nada a ganhar em servi-la de cache.
 */
export const dynamic = "force-dynamic";

export default async function MarketingSeoPage() {
  const supabase = createClient(await cookies());
  const t = await getTranslations();

  const shell = await getMarketingShellData(
    supabase,
    t("sidebar.groups.marketing"),
    t("sidebar.groups.admin"),
  );

  const viewerLocale: Locale = LOCALES.includes(shell.locale as Locale)
    ? (shell.locale as Locale)
    : "pt";
  const { rows, loadError } = await loadSeoRows(supabase, viewerLocale);

  return (
    <InternalChrome
      role={shell.role}
      userName={shell.userName}
      userMeta={shell.userMeta}
      activeId="seo"
      locale={shell.locale}
      onLocaleChange={setLocalePreference}
      counters={shell.counters}
    >
      <SeoManager rows={rows} loadError={loadError} locale={shell.locale} onSave={saveSeoPage} />
    </InternalChrome>
  );
}
