import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

/**
 * Capas de uma lista de imóveis, em duas ida-e-volta em vez de 2N (12 §10.3)
 * ===========================================================================
 * O `/market` e o `/propriedades` desenham uma grelha de cartões, e cada
 * cartão precisa de uma coisa que não vem na linha do imóvel: o URL assinado
 * da fotografia de capa. O bucket é privado — nunca `getPublicUrl` —, por isso
 * o URL tem de ser pedido, e não construído.
 *
 * A primeira versão pedia-o **dentro do `map`**, uma vez por imóvel: uma
 * consulta à `property_media` e uma chamada ao Storage, por cartão. Com o
 * `PAGE_SIZE` de 20 isso são **40 ida-e-volta para desenhar uma página**, e o
 * número não depende do tráfego — multiplica-o. A 100 visitas por segundo são
 * 4000 pedidos por segundo ao Supabase para mostrar vinte fotografias.
 *
 * É o padrão N+1, e tem a propriedade desagradável de não se ver em
 * desenvolvimento: com três imóveis de teste e a base ao lado, 6 ida-e-volta
 * são instantâneas. Só aparece quando há utilizadores — e aparece como
 * "o site está lento", sem erro nenhum a apontar para aqui.
 *
 * Esta função faz as mesmas duas perguntas uma vez só:
 *
 *  1. **Uma** consulta com `in (…)` para as capas de todos os imóveis.
 *  2. **Uma** chamada a `createSignedUrls` (plural) para assinar todos os
 *     caminhos de uma vez.
 *
 * Vive em `@upm/db` e não em cada página porque as duas páginas fazem
 * exatamente o mesmo, e duas cópias desta lógica divergem na primeira vez que
 * a regra da capa mudar.
 */

/** O que define a capa: `is_cover` primeiro, depois a posição. */
type LinhaMedia = {
  property_id: string;
  path: string;
  is_cover: boolean | null;
  position: number | null;
};

const BUCKET = "property-media";

/** Uma hora, como antes. O cartão vive muito menos do que isso. */
const TTL_SEGUNDOS = 3600;

export async function coverUrlsFor(
  supabase: SupabaseClient<Database>,
  propertyIds: ReadonlyArray<string | null | undefined>,
  ttlSegundos: number = TTL_SEGUNDOS,
): Promise<Map<string, string | null>> {
  const ids = [...new Set(propertyIds.filter((id): id is string => Boolean(id)))];
  const porImovel = new Map<string, string | null>(ids.map((id) => [id, null]));
  if (ids.length === 0) return porImovel;

  const { data: media } = await supabase
    .from("property_media")
    .select("property_id, path, is_cover, position")
    .in("property_id", ids);

  // A escolha da capa passa a ser feita aqui, em memória, sobre um conjunto
  // pequeno (as fotos de uma página de resultados). Ordenar no Postgres
  // obrigaria a uma consulta por imóvel — que é precisamente o que se está a
  // evitar.
  const melhor = new Map<string, LinhaMedia>();
  for (const linha of (media ?? []) as LinhaMedia[]) {
    const atual = melhor.get(linha.property_id);
    if (atual === undefined || ganha(linha, atual)) melhor.set(linha.property_id, linha);
  }

  const caminhos = [...melhor.values()].map((linha) => linha.path);
  if (caminhos.length === 0) return porImovel;

  const { data: assinados } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(caminhos, ttlSegundos);

  const urlPorCaminho = new Map<string, string>();
  for (const item of assinados ?? []) {
    if (item.path && item.signedUrl) urlPorCaminho.set(item.path, item.signedUrl);
  }

  for (const [propertyId, linha] of melhor) {
    porImovel.set(propertyId, urlPorCaminho.get(linha.path) ?? null);
  }

  return porImovel;
}

/** `is_cover` ganha sempre; entre iguais, a posição mais baixa. */
function ganha(candidata: LinhaMedia, atual: LinhaMedia): boolean {
  const capaCandidata = candidata.is_cover === true;
  const capaAtual = atual.is_cover === true;
  if (capaCandidata !== capaAtual) return capaCandidata;
  return (
    (candidata.position ?? Number.MAX_SAFE_INTEGER) < (atual.position ?? Number.MAX_SAFE_INTEGER)
  );
}
