import type { SupabaseClient } from "@supabase/supabase-js";
import { LOCALES, type Locale } from "@upm/config";
import type { Database } from "@upm/db";
import { SEO_ROUTES } from "@upm/config/seo-routes";

import type { SeoLastChange, SeoPageRow } from "./SeoManager";

/**
 * As linhas do painel de SEO, numa função e não em duas páginas (07 §24.5)
 * =========================================================================
 * Existe porque o SEO tem **duas portas**: `/admin/seo` e `/marketing/seo`. A
 * nota do `MARKETING_NAV` é explícita em dizer que a segunda é uma porta e
 * *"não uma segunda cópia"* — e o que estava a dois passos de acontecer era
 * precisamente a cópia: duzentas linhas de cruzamento de `SEO_ROUTES` com
 * `seo_pages` e o `audit_log`, repetidas, a divergir à primeira alteração.
 *
 * O que sobra em cada página é o que **é** diferente entre as duas: o papel, o
 * grupo da barra lateral e os contadores. Nada disto.
 *
 * ## O que esta função cruza, e porque são três origens
 *
 *  - `SEO_ROUTES` — o inventário gerado dos `seo.ts` do `apps/web`. É quem sabe
 *    que páginas existem; uma tabela nunca saberia.
 *  - `seo_pages` — o que alguém editou. Só tem linhas para as páginas
 *    personalizadas, e é por isso que a maioria aparece como "Usa predefinições".
 *  - `audit_log` — o rasto. Uma página personalizada e depois **devolvida ao
 *    ficheiro** não tem linha nenhuma: a função SQL apaga-a, e sem o registo
 *    essa alteração não apareceria em sítio nenhum.
 *
 * ## O marketing lê menos, e isso é dito e não escondido
 *
 * A policy `audit_log_marketing_seo_select` dá-lhe as linhas de `seo_pages` e
 * mais nada. Se algum dia for revogada, a leitura não dá erro — a RLS devolve
 * zero linhas —, e a coluna "última alteração" ficaria vazia nas rotas
 * devolvidas ao ficheiro, calada. É por isso que `auditUnavailable` é devolvido
 * a par das linhas: quem chama fica a saber que leu menos do que queria.
 */

type Client = SupabaseClient<Database>;

export type SeoRowsResult = {
  rows: SeoPageRow[];
  /** O `seo_pages` não respondeu: o painel mostra o aviso de leitura falhada. */
  loadError: boolean;
  /** O `audit_log` não respondeu ou veio vazio por RLS — ver a nota de topo. */
  auditUnavailable: boolean;
};

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

export async function loadSeoRows(
  supabase: Client,
  /**
   * O idioma de quem está a **ver** o painel, que não é o que se está a editar.
   * O `pageName` da lista vem neste idioma: trocá-lo ao mudar de aba fazia a
   * linha parecer outra linha.
   */
  viewerLocale: Locale,
): Promise<SeoRowsResult> {
  const [overridesResult, auditResult] = await Promise.all([
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

  return {
    rows,
    loadError: Boolean(overridesResult.error),
    auditUnavailable: Boolean(auditResult.error),
  };
}
