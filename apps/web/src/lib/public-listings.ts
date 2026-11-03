import { unstable_cache } from "next/cache";
import { SITE_CACHE_TAGS, listingTag } from "@upm/config/site-cache-tags";
import { createAnonClient } from "@upm/db/server";

/**
 * Imóveis no site público (P2-05 · 04 §2.1)
 * =========================================================================
 * **Lê sempre `properties_public`, nunca `properties`.** A view é a única porta
 * de leitura pública: exclui `location`, `address_line`, `postal_code` e tudo
 * o que seja do dono além do `id` (08 §2.7), e já filtra
 * `status in ('active','featured')`. Pedir `properties` direto daqui não
 * devolveria nada — a RLS só deixa o dono e o staff lerem — e, se um dia
 * deixasse, exporia a coordenada exata de casa de alguém.
 *
 * Cliente `anon` e sem cookies: o Market público é o mesmo para toda a gente,
 * e passar sessão tornaria a resposta impossível de partilhar em cache.
 * Confirmado a 12 out 2026 contra o staging: `anon` lê a view e
 * `property_media` sem erro de permissão.
 *
 * **ISR de 5 minutos**, que é o que 04 §2.1 pede. A tag `listings` está posta
 * em todas as leituras e é a que 04 §2.1 quer invalidada ao publicar ou aprovar
 * um imóvel — mas quem aprova é o Admin, que corre noutro processo Next e não
 * toca nesta cache. É o **D61**: falta a rota de invalidação no `www`. Até lá
 * os cinco minutos são o mecanismo, e cumprem o requisito escrito; a tag fica
 * pronta para o dia em que a rota existir.
 *
 * O TTL do URL assinado da foto (3600 s) tem de ser **maior** do que a janela
 * de ISR, senão a cache serviria links já expirados. 300 < 3600, com folga.
 */

/** 5 minutos — 04 §2.1 ("Revalidação ISR a cada 5 min"). */
const REVALIDATE = 300;

// A mesma etiqueta que o `interno` e o `app` pedem para invalidar (F2).
export const LISTINGS_TAG = SITE_CACHE_TAGS.listings;

/** Uma hora, o mesmo do Market da app autenticada. Ver a nota acima. */
const SIGNED_URL_TTL = 3600;

export type PublicListingCard = {
  id: string;
  slug: string;
  title: string;
  deal: "sale" | "rent" | null;
  typology: string | null;
  city: string | null;
  grossArea: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  priceCents: number | null;
  rentCents: number | null;
  coverUrl: string | null;
  publishedAt: string | null;
};

export type PublicListingDetail = PublicListingCard & {
  ref: string;
  description: string | null;
  propertyType: string | null;
  condition: string | null;
  netArea: number | null;
  floor: string | null;
  yearBuilt: number | null;
  energyCert: string | null;
  condoFeeCents: number | null;
  amenities: string[];
  parish: string | null;
  district: string | null;
  /** Ponto **aproximado**. A coordenada exata nunca sai da view. */
  approx: { lon: number; lat: number; radiusM: number | null } | null;
  photoUrls: string[];
};

export type PublicListingFilters = {
  deal?: "sale" | "rent";
  propertyType?: string;
  typology?: string;
  city?: string;
  priceMinCents?: number;
  priceMaxCents?: number;
};

export const LISTINGS_PAGE_SIZE = 12;

/**
 * O slug de uma ficha: `titulo-em-kebab-{uuid}`.
 *
 * **Porque é que o id vai no fim e não há coluna `slug`.** 04 §2.1.2 pede a
 * rota `/propriedades/[slug]`, e um slug só com o título não serve: `properties`
 * não tem coluna de slug, os títulos não são únicos (nem obrigatórios — em
 * staging estão todos vazios) e mudar um título partiria o link antigo.
 *
 * Com o `uuid` no fim ganham-se as três coisas de uma vez: o URL é descritivo
 * para quem o lê e para os motores de busca, a resolução é uma igualdade pela
 * chave primária, e **mudar o título não quebra nada** — o id continua lá, e
 * a página redireciona para o slug canónico.
 *
 * O id vai no **fim**, e não no início, porque a forma de um UUID é fixa (36
 * caracteres, cinco grupos separados por `-`): recortar os últimos 36 é exato,
 * enquanto procurar um `ref` no meio de um slug seria ambíguo — os `ref` deste
 * projeto têm hífenes (`BILL-SAVE-…`) e não se distinguiriam dos do título.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Acentos fora, minúsculas, um hífen por corte. Sem `unaccent` do Postgres. */
function kebab(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
}

export function listingSlug(listing: { id: string; title: string | null }): string {
  const prefix = kebab(listing.title ?? "");
  return prefix ? `${prefix}-${listing.id}` : listing.id;
}

/** O id que um slug aponta, ou `null` se o slug não terminar num UUID. */
export function listingIdFromSlug(slug: string): string | null {
  const tail = slug.slice(-36);
  return UUID.test(tail) ? tail.toLowerCase() : null;
}

type Row = {
  id: string | null;
  title: string | null;
  deal: "sale" | "rent" | null;
  typology: string | null;
  city: string | null;
  gross_area: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  price_cents: number | null;
  rent_cents: number | null;
  published_at: string | null;
};

const CARD_COLUMNS =
  "id, title, deal, typology, city, gross_area, bedrooms, bathrooms, price_cents, rent_cents, published_at";

function toCard(row: Row, coverUrl: string | null): PublicListingCard {
  const id = row.id ?? "";
  return {
    id,
    slug: listingSlug({ id, title: row.title }),
    title: row.title?.trim() || "Propriedade sem título",
    deal: row.deal,
    typology: row.typology,
    city: row.city,
    grossArea: row.gross_area,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    priceCents: row.price_cents,
    rentCents: row.rent_cents,
    coverUrl,
    publishedAt: row.published_at,
  };
}

type AnonClient = ReturnType<typeof createAnonClient>;

/**
 * As capas de vários imóveis em **duas** consultas, não em duas por imóvel.
 *
 * O Market da app autenticada faz uma consulta a `property_media` e uma
 * assinatura por cartão, dentro de um `Promise.all` — com 20 cartões são 40
 * idas à base de dados por página. Aqui, numa página pública que o Lighthouse
 * vai medir (04 §2.1 AC), isso não serve: pede-se a media de todos os ids de
 * uma vez e assinam-se os caminhos em lote.
 */
async function coversFor(supabase: AnonClient, ids: string[]): Promise<Map<string, string | null>> {
  const covers = new Map<string, string | null>();
  if (ids.length === 0) return covers;

  const { data: media } = await supabase
    .from("property_media")
    .select("property_id, path, is_cover, position")
    .in("property_id", ids)
    .order("is_cover", { ascending: false })
    .order("position", { ascending: true });

  // Primeira por imóvel, na ordem que a consulta já garante: capa primeiro,
  // depois posição.
  const firstPath = new Map<string, string>();
  for (const row of media ?? []) {
    if (row.property_id && row.path && !firstPath.has(row.property_id)) {
      firstPath.set(row.property_id, row.path);
    }
  }
  if (firstPath.size === 0) return covers;

  const paths = [...firstPath.values()];
  const { data: signed } = await supabase.storage
    .from("property-media")
    .createSignedUrls(paths, SIGNED_URL_TTL);

  const urlByPath = new Map((signed ?? []).map((item) => [item.path ?? "", item.signedUrl]));
  for (const [id, path] of firstPath) covers.set(id, urlByPath.get(path) ?? null);
  return covers;
}

async function fetchRecent(limit: number): Promise<PublicListingCard[]> {
  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from("properties_public")
    .select(CARD_COLUMNS)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  const rows = data as Row[];
  const covers = await coversFor(supabase, rows.map((row) => row.id ?? "").filter(Boolean));
  return rows.map((row) => toCard(row, covers.get(row.id ?? "") ?? null));
}

/**
 * Os últimos imóveis publicados, para a secção da home em pós-lançamento.
 *
 * Falha aberta: uma leitura que rebente devolve lista vazia, e a secção
 * simplesmente não aparece. Uma home que rebenta inteira porque a consulta de
 * imóveis falhou é muito pior do que uma home sem a secção.
 */
export async function getRecentListings(limit = 6): Promise<PublicListingCard[]> {
  try {
    const cached = unstable_cache(
      () => fetchRecent(limit),
      ["public-listings-recent", String(limit)],
      {
        tags: [LISTINGS_TAG],
        revalidate: REVALIDATE,
      },
    );
    return await cached();
  } catch {
    return [];
  }
}

async function fetchPage(
  filters: PublicListingFilters,
  page: number,
): Promise<{ listings: PublicListingCard[]; total: number }> {
  const supabase = createAnonClient();
  let query = supabase
    .from("properties_public")
    .select(CARD_COLUMNS, { count: "exact" })
    .order("published_at", { ascending: false });

  if (filters.deal) query = query.eq("deal", filters.deal);
  if (filters.propertyType) query = query.eq("property_type", filters.propertyType);
  if (filters.typology) query = query.eq("typology", filters.typology);
  if (filters.city) query = query.ilike("city", `%${filters.city}%`);
  // O preço de venda e o de arrendamento são colunas diferentes, e um filtro
  // de preço sobre `price_cents` deixaria de fora todos os arrendamentos.
  // `or` cobre as duas, mantendo o significado: "o valor pedido está neste
  // intervalo", seja ele renda ou venda.
  if (filters.priceMinCents !== undefined) {
    query = query.or(
      `price_cents.gte.${filters.priceMinCents},rent_cents.gte.${filters.priceMinCents}`,
    );
  }
  if (filters.priceMaxCents !== undefined) {
    query = query.or(
      `price_cents.lte.${filters.priceMaxCents},rent_cents.lte.${filters.priceMaxCents}`,
    );
  }

  const from = (page - 1) * LISTINGS_PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + LISTINGS_PAGE_SIZE - 1);
  if (error || !data) return { listings: [], total: 0 };

  const rows = data as Row[];
  const covers = await coversFor(supabase, rows.map((row) => row.id ?? "").filter(Boolean));
  return {
    listings: rows.map((row) => toCard(row, covers.get(row.id ?? "") ?? null)),
    total: count ?? 0,
  };
}

/** Uma página de `/propriedades`, com os filtros aplicados. */
export async function getPublicListings(
  filters: PublicListingFilters,
  page = 1,
): Promise<{ listings: PublicListingCard[]; total: number }> {
  // A chave da cache inclui os filtros: duas pesquisas diferentes não podem
  // partilhar entrada. A ordem das chaves é fixada pelo `JSON.stringify` de um
  // objeto construído sempre na mesma ordem, senão `{deal,city}` e
  // `{city,deal}` geravam duas entradas para a mesma pesquisa.
  const key = JSON.stringify([
    filters.deal ?? "",
    filters.propertyType ?? "",
    filters.typology ?? "",
    filters.city ?? "",
    filters.priceMinCents ?? "",
    filters.priceMaxCents ?? "",
    page,
  ]);
  try {
    const cached = unstable_cache(() => fetchPage(filters, page), ["public-listings-page", key], {
      tags: [LISTINGS_TAG],
      revalidate: REVALIDATE,
    });
    return await cached();
  } catch {
    return { listings: [], total: 0 };
  }
}

async function fetchListing(id: string): Promise<PublicListingDetail | null> {
  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from("properties_public")
    .select(
      `${CARD_COLUMNS}, ref, description, property_type, condition, net_area, floor, year_built, energy_cert, condo_fee_cents, amenities, parish, district, location_approx, approx_radius_m`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as Row & Record<string, unknown>;

  const [covers, photos] = await Promise.all([
    coversFor(supabase, [id]),
    (async () => {
      const { data: media } = await supabase
        .from("property_media")
        .select("path, is_cover, position")
        .eq("property_id", id)
        .order("is_cover", { ascending: false })
        .order("position", { ascending: true });
      const paths = (media ?? [])
        .map((item) => item.path)
        .filter((path): path is string => Boolean(path));
      if (paths.length === 0) return [];
      const { data: signed } = await supabase.storage
        .from("property-media")
        .createSignedUrls(paths, SIGNED_URL_TTL);
      return (signed ?? [])
        .map((item) => item.signedUrl)
        .filter((url): url is string => Boolean(url));
    })(),
  ]);

  const card = toCard(row, covers.get(id) ?? null);
  return {
    ...card,
    ref: String(row.ref ?? ""),
    description: (row.description as string | null) ?? null,
    propertyType: (row.property_type as string | null) ?? null,
    condition: (row.condition as string | null) ?? null,
    netArea: (row.net_area as number | null) ?? null,
    floor: (row.floor as string | null) ?? null,
    yearBuilt: (row.year_built as number | null) ?? null,
    energyCert: (row.energy_cert as string | null) ?? null,
    condoFeeCents: (row.condo_fee_cents as number | null) ?? null,
    amenities: Array.isArray(row.amenities) ? (row.amenities as string[]) : [],
    parish: (row.parish as string | null) ?? null,
    district: (row.district as string | null) ?? null,
    approx: approxFrom(row.location_approx, row.approx_radius_m as number | null),
    photoUrls: photos,
  };
}

/**
 * `location_approx` é `geography` e chega como GeoJSON pelo PostgREST. O Mapa
 * da app usa a função `properties_for_map`, que já devolve lon/lat extraídos;
 * aqui há uma linha só, por isso lê-se o GeoJSON direto em vez de chamar uma
 * função feita para caixas de pesquisa.
 */
function approxFrom(
  value: unknown,
  radiusM: number | null,
): { lon: number; lat: number; radiusM: number | null } | null {
  if (!value || typeof value !== "object") return null;
  const coordinates = (value as { coordinates?: unknown }).coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const [lon, lat] = coordinates;
  if (typeof lon !== "number" || typeof lat !== "number") return null;
  return { lon, lat, radiusM };
}

/** O detalhe público pelo id que o slug carrega. */
export async function getPublicListing(id: string): Promise<PublicListingDetail | null> {
  try {
    const cached = unstable_cache(() => fetchListing(id), ["public-listing", id], {
      tags: [LISTINGS_TAG, listingTag(id)],
      revalidate: REVALIDATE,
    });
    return await cached();
  } catch {
    return null;
  }
}

/**
 * "Nunca existiu" ou "já não está" (P2-05)
 * =========================================================================
 * `properties_public` não distingue os dois — filtra `status in
 * ('active','featured')`, por isso um uuid inventado e uma propriedade vendida
 * devolvem ambos nada. Quem decide é a função `listing_availability`, que corre
 * `security definer` e só revela o que já esteve publicado; a migração
 * `20261013090000_listing_availability.sql` tem as regras todas.
 *
 * **Falha para `never`, deliberadamente.** Se a função der erro, se a resposta
 * vier vazia ou com um `outcome` inesperado, o resultado é `never` — e a
 * página dá 404, que é o comportamento de antes. Um erro aqui nunca pode
 * transformar-se em "esta propriedade foi vendida" sobre uma propriedade que
 * não existe.
 */
export type ListingAvailability =
  | { outcome: "never" }
  | {
      outcome: "gone";
      reason: "sold" | "rented" | "withdrawn";
      deal: "sale" | "rent" | null;
      city: string | null;
    };

const GONE_REASONS = new Set(["sold", "rented", "withdrawn"]);

async function fetchAvailability(id: string): Promise<ListingAvailability> {
  const supabase = createAnonClient();

  const { data, error } = await supabase.rpc("listing_availability", { p_property_id: id });
  if (error) return { outcome: "never" };

  // A função devolve `table(...)`, logo um array. Continua a validar-se campo a
  // campo mesmo com os tipos gerados: o que o compilador garante é a **forma**,
  // e o que interessa aqui é que um `outcome` inesperado caia para `never` em
  // vez de inventar uma venda — ver a nota de `getListingAvailability`.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || row.outcome !== "gone") return { outcome: "never" };

  return {
    outcome: "gone",
    reason:
      typeof row.reason === "string" && GONE_REASONS.has(row.reason)
        ? (row.reason as "sold" | "rented" | "withdrawn")
        : "withdrawn",
    deal: row.deal === "sale" || row.deal === "rent" ? row.deal : null,
    city: typeof row.city === "string" && row.city.trim() !== "" ? row.city : null,
  };
}

export async function getListingAvailability(id: string): Promise<ListingAvailability> {
  try {
    const cached = unstable_cache(() => fetchAvailability(id), ["listing-availability", id], {
      tags: [LISTINGS_TAG, listingTag(id)],
      revalidate: REVALIDATE,
    });
    return await cached();
  } catch {
    return { outcome: "never" };
  }
}
