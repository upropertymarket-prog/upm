import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { LOCALES, type Locale } from "@upm/config";
import { createClient } from "@upm/db/server";

import { InternalChrome } from "../../../components/InternalChrome";
import { getAdminSidebarCounters } from "../../../lib/admin-shell";
import { setLocalePreference } from "../../actions/preferences";
import { saveSeoPage } from "./actions";
import { loadSeoRows } from "./rows";
import { SeoManager } from "./SeoManager";

/**
 * `/admin/seo` — SEO e Open Graph por página (P2-06 2.ª metade · 04 §2.1.1)
 * =========================================================================
 * **Uma linha por página pública**, cruzando duas origens que nenhuma delas
 * conhece a outra:
 *
 *  - `SEO_ROUTES` — o inventário gerado a partir dos `seo.ts` do `apps/web`
 *    por `scripts/generate-seo-routes.mjs`. É quem sabe que páginas existem;
 *    uma tabela nunca saberia. O `gate:seo` falha o PR se ficar desatualizado.
 *  - `seo_pages` — o que alguém editou aqui. Só tem linhas para as páginas
 *    personalizadas, e é por isso que a maioria das linhas da lista aparece
 *    como "Usa predefinições".
 *
 * O Admin corre noutra aplicação Next que não o `www`, e é essa a razão de o
 * inventário ser um ficheiro gerado em `@upm/config` em vez de uma leitura
 * direta ao `apps/web`: em produção só existe o build de cada app.
 *
 * **"Quando e por quem" vem de duas origens, e não de uma data de ficheiro.**
 * Uma página personalizada tem a resposta na própria linha — `updated_at` e
 * `updated_by`, fixados pela função SQL e não aceitos de quem chama. Uma página
 * que já foi personalizada e depois devolvida ao ficheiro **não tem linha
 * nenhuma**: a função apaga-a, e sem o `audit_log` essa alteração — que é das
 * que mais vale a pena ver — não apareceria em sítio nenhum. É por isso que o
 * registo é lido aqui, e é a razão de a rota ir no `diff` (ver `actions.ts`).
 *
 * `force-dynamic` porque a lista muda com cada gravação e é uma página de
 * administração — não há nada a ganhar em servi-la de cache.
 *
 * ---------------------------------------------------------------------------
 * BILINGUE DESDE 21 OUT 2026 (D72 fase C)
 * ---------------------------------------------------------------------------
 * `seo_pages` passou a ter a chave `(route, locale)`, e por isso **uma rota
 * tem agora até duas sobreposições**. A lista continua com uma linha por rota
 * — treze e não vinte e seis — porque os dois idiomas de uma página editam-se
 * a olhar um para o outro, e separá-los em duas linhas da tabela obrigaria a
 * abrir e fechar o painel para comparar um título com a sua tradução.
 *
 * O que muda na lista é a coluna de estado: passa a dizer o estado de **cada**
 * idioma, porque "personalizada" deixou de ser uma resposta completa.
 *
 * ---------------------------------------------------------------------------
 * O CRUZAMENTO MUDOU-SE PARA `rows.ts` (21 out 2026)
 * ---------------------------------------------------------------------------
 * Porque o SEO passou a ter **duas portas**: esta e `/marketing/seo`, que 07
 * §24.5 pede e que dava 404 desde P10-07. O que as distingue é o papel, o
 * grupo da barra lateral e os contadores — e é só isso que ficou aqui. Tudo o
 * que descreve o painel em si vive agora em `loadSeoRows`, para as duas portas
 * lerem a mesma coisa em vez de divergirem à primeira alteração.
 */
export const dynamic = "force-dynamic";

export default async function SeoPage() {
  const supabase = createClient(await cookies());

  const [auth, sidebarCounters] = await Promise.all([
    supabase.auth.getUser(),
    getAdminSidebarCounters(supabase),
  ]);

  const userId = auth.data.user?.id ?? null;
  const [{ data: profile }, { data: staff }] = await Promise.all([
    userId
      ? supabase.from("profiles").select("full_name,locale").eq("id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
    userId
      ? supabase.from("staff_members").select("department").eq("profile_id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const t = await getTranslations();
  const locale = profile?.locale ?? "pt";
  const userName = profile?.full_name?.trim() || auth.data.user?.email || "—";
  const userMeta = staff?.department
    ? `${t("sidebar.groups.admin")} · ${staff.department}`
    : t("sidebar.groups.admin");

  const viewerLocale: Locale = LOCALES.includes(locale as Locale) ? (locale as Locale) : "pt";
  const { rows, loadError } = await loadSeoRows(supabase, viewerLocale);

  return (
    <InternalChrome
      role="admin"
      userName={userName}
      userMeta={userMeta}
      activeId="seo"
      locale={locale}
      onLocaleChange={setLocalePreference}
      counters={sidebarCounters}
    >
      <SeoManager rows={rows} loadError={loadError} locale={locale} onSave={saveSeoPage} />
    </InternalChrome>
  );
}
