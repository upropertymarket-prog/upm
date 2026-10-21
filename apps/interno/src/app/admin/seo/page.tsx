import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { LOCALES, type Locale } from "@upm/config";
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
 */
export const dynamic = "force-dynamic";

/**
 * A rota e o idioma a que um registo de `seo.updated` se refere, guardados no
 * `diff` (ver `actions.ts`).
 *
 * Um registo anterior a 21 out 2026 não tem `locale` — foi escrito quando a
 * sobreposição se aplicava às duas línguas. Esses contam para o português, que
 * é a língua-fonte e a que a migração atribuiu as linhas existentes: é a
 * leitura honesta do que aconteceu, e não um palpite.
 */
function auditedKey(diff: unknown): { route: string; locale: Locale } | null {
  if (!diff || typeof diff !== "object" || Array.isArray(diff)) return null;
  const record = diff as Record<string, unknown>;
  const route = record.route;
  if (typeof route !== "string" || route.length === 0) return null;
  const locale = LOCALES.includes(record.locale as Locale) ? (record.locale as Locale) : "pt";
  return { route, locale };
}

/** A chave composta como string, para servir de chave de `Map`. */
const keyOf = (route: string, locale: Locale) => `${locale}:${route}`;

export default async function SeoPage() {
  const supabase = createClient(await cookies());

  const [auth, overridesResult, auditResult, sidebarCounters] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("seo_pages")
      .select(
        "route, locale, title_tag, meta_description, og_same_as_page, og_title, og_description, og_image, og_image_alt, canonical, noindex, updated_at, updated_by",
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

  const overrides = new Map(
    (overridesResult.data ?? []).map((row) => [keyOf(row.route, row.locale as Locale), row]),
  );

  // Vem ordenado do mais recente para o mais antigo: o primeiro registo de cada
  // rota **e idioma** é o que interessa, e os seguintes ignoram-se.
  const lastAudited = new Map<string, { at: string; actorId: string | null }>();
  for (const entry of auditResult.data ?? []) {
    const audited = auditedKey(entry.diff);
    if (!audited) continue;
    const key = keyOf(audited.route, audited.locale);
    if (lastAudited.has(key)) continue;
    lastAudited.set(key, { at: entry.created_at, actorId: entry.actor_id });
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

  /**
   * Uma linha por rota, com os dois idiomas dentro dela.
   *
   * O `pageName` da lista vem no idioma **de quem está a ver o painel**, e não
   * no idioma que se está a editar: é o nome da página nesta lista, e trocá-lo
   * ao mudar de aba fazia a linha parecer outra linha. Os textos que se editam
   * são os de dentro de cada aba, e esses são por idioma.
   */
  const viewerLocale: Locale = LOCALES.includes(locale as Locale) ? (locale as Locale) : "pt";

  const rows: SeoPageRow[] = SEO_ROUTES.map((entry) => ({
    route: entry.route,
    pageName: entry.text[viewerLocale].pageName || entry.text.pt.pageName,
    dynamic: entry.dynamic,
    path: entry.path,
    locales: Object.fromEntries(
      LOCALES.map((loc) => {
        const override = overrides.get(keyOf(entry.route, loc));
        const audited = lastAudited.get(keyOf(entry.route, loc));

        // Com linha, a linha manda: `updated_at` é da própria gravação e nunca
        // fica atrás do registo. Sem linha, o registo é o único rasto que
        // resta — e o que ele conta é precisamente a devolução ao ficheiro.
        let lastChange: SeoLastChange | null = null;
        if (override) {
          lastChange = { at: override.updated_at, by: nameOf(override.updated_by) };
        } else if (audited) {
          lastChange = { at: audited.at, by: nameOf(audited.actorId), reset: true };
        }

        return [
          loc,
          {
            defaults: {
              titleTag: entry.text[loc].titleTag,
              metaDescription: entry.text[loc].metaDescription,
            },
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
          },
        ];
      }),
    ) as SeoPageRow["locales"],
  }));

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
