import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Invalidar a cache do site público a partir das outras apps (F2 · D61)
 * =========================================================================
 * O `www` guarda em `unstable_cache` o catálogo, as fichas, os planos, o modo
 * de lançamento e o SEO. Quem muda essas coisas é o `interno` (aprovar um
 * anúncio, mudar o modo, editar um plano ou uma página de SEO) e o `app` (o
 * proprietário edita o seu anúncio) — outros processos Next, cujo
 * `revalidatePath` nunca chegou ao `www`. O resultado, visto pelo E2E de 2
 * nov: um anúncio aprovado ficava até 5 min fora do site, e escondido de vez
 * até a cache expirar se alguém tivesse aberto a ficha antes.
 *
 * Uma etiqueta atravessa apps porque é o `www` que a possui. As outras apps
 * pedem-lhe que a invalide, por `POST /api/revalidate`, com um segredo
 * partilhado (`SITE_REVALIDATE_SECRET`).
 *
 * **Nunca atira.** A decisão (a aprovação, o plano gravado) já está feita
 * quando isto corre, e a cache tem sempre o seu prazo como rede de segurança:
 * uma invalidação perdida atrasa, não perde. Falhar regista-se, à vista.
 *
 * **Chama-se em `after()`** (`next/server`): corre depois de a resposta sair,
 * para quem aprovou não esperar pelo `www`, e sem o risco de um
 * "dispara e esquece", que o servidor pode cortar a meio.
 */

import { isSiteCacheTag } from "./site-cache-tags";

export * from "./site-cache-tags";

/**
 * Compara o cabeçalho com o segredo em tempo constante. Por resumos e não
 * pelos textos, para o tamanho do segredo também não se poder medir.
 */
export function segredoConfere(cabecalho: string | null, segredo: string | undefined): boolean {
  if (!segredo || !cabecalho?.startsWith("Bearer ")) return false;
  const a = createHash("sha256").update(cabecalho.slice("Bearer ".length)).digest();
  const b = createHash("sha256").update(segredo).digest();
  return timingSafeEqual(a, b);
}

/** Pede ao `www` que invalide estas etiquetas. Devolve se conseguiu; nunca atira. */
export async function invalidarCacheDoSite(tags: string[]): Promise<boolean> {
  const segredo = process.env.SITE_REVALIDATE_SECRET;
  const site = process.env.WEB_URL;
  const validas = tags.filter(isSiteCacheTag);
  if (validas.length === 0) return true;
  if (!segredo || !site) {
    console.error(
      "[cache-do-site] sem SITE_REVALIDATE_SECRET ou WEB_URL: fica pelo prazo da cache.",
    );
    return false;
  }
  try {
    const resposta = await fetch(new URL("/api/revalidate", site), {
      method: "POST",
      headers: { authorization: `Bearer ${segredo}`, "content-type": "application/json" },
      body: JSON.stringify({ tags: validas }),
      // Os chamadores correm isto em `after()`, depois de a resposta sair:
      // ninguém fica à espera. 3 s não chegavam a um `www` frio (visto no E2E,
      // a primeira compilação da rota em dev); 10 s cobrem um arranque a frio.
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    return true;
  } catch (erro) {
    console.error(
      "[cache-do-site] não invalidou",
      validas.join(","),
      erro instanceof Error ? erro.message : erro,
    );
    return false;
  }
}
