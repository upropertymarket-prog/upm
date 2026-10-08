import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { createClient } from "@upm/db/server";
import { SEO_ROUTES } from "@upm/config/seo-routes";

import { InternalChrome } from "../../../components/InternalChrome";
import { getAdminSidebarCounters } from "../../../lib/admin-shell";
import { setLocalePreference } from "../../actions/preferences";
import { saveSeoPage } from "./actions";
import { SeoManager, type SeoPageRow } from "./SeoManager";

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
 * `force-dynamic` porque a lista muda com cada gravação e é uma página de
 * administração — não há nada a ganhar em servi-la de cache.
 */
export const dynamic = "force-dynamic";

export default async function SeoPage() {
  const supabase = createClient(await cookies());

  const [auth, overridesResult, sidebarCounters] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("seo_pages")
      .select(
        "route, title_tag, meta_description, og_same_as_page, og_title, og_description, og_image, og_image_alt, canonical, noindex, updated_at",
      ),
    getAdminSidebarCounters(supabase),
  ]);

  const overrides = new Map((overridesResult.data ?? []).map((row) => [row.route, row]));

  const rows: SeoPageRow[] = SEO_ROUTES.map((entry) => {
    const override = overrides.get(entry.route);
    return {
      route: entry.route,
      pageName: entry.pageName,
      dynamic: entry.dynamic,
      defaults: { titleTag: entry.titleTag, metaDescription: entry.metaDescription },
      override: override
        ? {
            titleTag: override.title_tag ?? "",
            metaDescription: override.meta_description ?? "",
            ogSameAsPage: override.og_same_as_page ?? true,
            ogTitle: override.og_title ?? "",
            ogDescription: override.og_description ?? "",
            ogImage: override.og_image ?? "",
            ogImageAlt: override.og_image_alt ?? "",
            canonical: override.canonical ?? "",
            noindex: override.noindex ?? false,
            updatedAt: override.updated_at,
          }
        : null,
    };
  });

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
      <SeoManager rows={rows} loadError={Boolean(overridesResult.error)} onSave={saveSeoPage} />
    </InternalChrome>
  );
}
