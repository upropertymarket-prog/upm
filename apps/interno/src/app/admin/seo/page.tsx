import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { createClient } from "@upm/db/server";
import { SEO_ROUTES } from "@upm/config/seo-routes";

import { InternalChrome } from "../../../components/InternalChrome";
import { getAdminSidebarCounters } from "../../../lib/admin-shell";
import { setLocalePreference } from "../../actions/preferences";
import { saveSeoPage } from "./actions";
import { SeoManager, type SeoLastChange, type SeoPageRow } from "./SeoManager";

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
 */
export const dynamic = "force-dynamic";

/** A rota a que um registo de `seo.updated` se refere, guardada no `diff`. */
function auditedRoute(diff: unknown): string | null {
  if (!diff || typeof diff !== "object" || Array.isArray(diff)) return null;
  const route = (diff as Record<string, unknown>).route;
  return typeof route === "string" && route.length > 0 ? route : null;
}

export default async function SeoPage() {
  const supabase = createClient(await cookies());

  const [auth, overridesResult, auditResult, sidebarCounters] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("seo_pages")
      .select(
        "route, title_tag, meta_description, og_same_as_page, og_title, og_description, og_image, og_image_alt, canonical, noindex, updated_at, updated_by",
      ),
    // Só o suficiente para a última alteração de cada rota: há uma dúzia de
    // rotas públicas, e um limite fixo impede esta leitura de crescer com o
    // histórico. Quem precisar do histórico completo tem o `audit_log`.
    supabase
      .from("audit_log")
      .select("actor_id, created_at, diff")
      .eq("entity", "seo_pages")
      .order("created_at", { ascending: false })
      .limit(300),
    getAdminSidebarCounters(supabase),
  ]);

  const overrides = new Map((overridesResult.data ?? []).map((row) => [row.route, row]));

  // Vem ordenado do mais recente para o mais antigo: o primeiro registo de cada
  // rota é o que interessa, e os seguintes ignoram-se.
  const lastAudited = new Map<string, { at: string; actorId: string | null }>();
  for (const entry of auditResult.data ?? []) {
    const route = auditedRoute(entry.diff);
    if (!route || lastAudited.has(route)) continue;
    lastAudited.set(route, { at: entry.created_at, actorId: entry.actor_id });
  }

  // Os nomes de quem alterou, numa leitura só. Um `id` sem perfil — apagado
  // entretanto — fica de fora do mapa e a coluna diz "autor removido".
  const authorIds = new Set<string>();
  for (const override of overrides.values())
    if (override.updated_by) authorIds.add(override.updated_by);
  for (const audited of lastAudited.values()) if (audited.actorId) authorIds.add(audited.actorId);

  const { data: authors } = authorIds.size
    ? await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", [...authorIds])
    : { data: [] };

  const nameOf = (id: string | null) => {
    if (!id) return null;
    const name = authors?.find((author) => author.id === id)?.full_name?.trim();
    return name || null;
  };

  const rows: SeoPageRow[] = SEO_ROUTES.map((entry) => {
    const override = overrides.get(entry.route);
    const audited = lastAudited.get(entry.route);

    // Com linha, a linha manda: `updated_at` é da própria gravação e nunca
    // fica atrás do registo. Sem linha, o registo é o único rasto que resta —
    // e o que ele conta é precisamente a devolução ao ficheiro.
    let lastChange: SeoLastChange | null = null;
    if (override) {
      lastChange = { at: override.updated_at, by: nameOf(override.updated_by) };
    } else if (audited) {
      lastChange = { at: audited.at, by: nameOf(audited.actorId), reset: true };
    }

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
          }
        : null,
      lastChange,
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
      <SeoManager
        rows={rows}
        loadError={Boolean(overridesResult.error)}
        locale={locale}
        onSave={saveSeoPage}
      />
    </InternalChrome>
  );
}
