/**
 * Geocoding da morada — 02 §11, formulário Nova propriedade (P4-02).
 * =========================================================================
 * Nominatim (OpenStreetMap), sem API key — decisão da Fase 4: MapTiler fica
 * reservado para trocar o estilo de tiles do Mapa em produção, registado como
 * dívida "confirmação de produção — fim do projeto" (07 §16.1), não bloqueia
 * o geocoding nem o Mapa em dev/staging.
 *
 * SSRF (08 §7.4): o host é fixo no código (nunca construído a partir de input
 * do utilizador) e a morada só entra como valor de `URLSearchParams` — um
 * parâmetro de pesquisa textual, não parte do host/path. Sem vetor de SSRF.
 */

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

// Política de uso do Nominatim exige um User-Agent identificável (não um
// User-Agent de browser genérico). Não é segredo — fica fixo no código.
// https://operations.osmfoundation.org/policies/nominatim/
const USER_AGENT = "UPropertyMarket/1.0 (+suporte@upropertymarket.pt)";

// Limitador simples de 1 req/s por instância de processo — a política do
// Nominatim exige 1 req/s no máximo. Não é distribuído (múltiplas instâncias
// serverless respeitam 1 req/s cada uma), mas o volume de "nova propriedade"
// é baixo e não há lote/batch a chamar isto — suficiente para esta fase, sem
// trazer fila/Redis.
let lastCallAt = 0;

async function throttle(): Promise<void> {
  const elapsed = Date.now() - lastCallAt;
  const wait = Math.max(0, 1000 - elapsed);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastCallAt = Date.now();
}

export type GeocodeResult = { lat: number; lon: number };

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  await throttle();

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", trimmed);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "pt");

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;

    const body = (await response.json()) as Array<{ lat: string; lon: string }>;
    const first = body[0];
    if (!first) return null;

    const lat = Number(first.lat);
    const lon = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    return { lat, lon };
  } catch {
    // Serviço externo indisponível não deve rebentar o formulário — quem
    // chama decide o que fazer com `null` (ex. avisar e deixar continuar
    // sem coordenadas, para corrigir depois).
    return null;
  }
}

const METERS_PER_DEGREE_LAT = 111_320;

/**
 * Offset determinístico dentro de `radiusMeters`, com seed = `propertyId`.
 * Determinístico de propósito: reprocessar o geocoding ao editar a morada
 * (mesmo property_id) tem de dar sempre o mesmo ponto aproximado — senão
 * `location_approx` "salta" a cada gravação e mina a confiança do raio
 * (07 §1: a aproximada é o único ponto que quem não tem grant vê).
 */
export async function approxOffset(
  propertyId: string,
  exact: GeocodeResult,
  radiusMeters: number,
): Promise<GeocodeResult> {
  const { createHash } = await import("node:crypto");
  const hash = createHash("sha256").update(propertyId).digest();
  const a = hash.readUInt32BE(0) / 0xffffffff;
  const b = hash.readUInt32BE(4) / 0xffffffff;

  const angle = a * 2 * Math.PI;
  // sqrt(b): distribuição uniforme na ÁREA do círculo, não só ao longo do raio.
  const distance = Math.sqrt(b) * radiusMeters;

  const dLat = (distance * Math.cos(angle)) / METERS_PER_DEGREE_LAT;
  const metersPerDegreeLon = METERS_PER_DEGREE_LAT * Math.cos((exact.lat * Math.PI) / 180);
  const dLon = metersPerDegreeLon === 0 ? 0 : (distance * Math.sin(angle)) / metersPerDegreeLon;

  return { lat: exact.lat + dLat, lon: exact.lon + dLon };
}

/** Formato aceite pelo PostgREST para colunas `geography(Point,4326)`. */
export function toEwkt({ lat, lon }: GeocodeResult): string {
  return `SRID=4326;POINT(${lon} ${lat})`;
}
