import { unstable_cache } from "next/cache";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { SITE_CACHE_TAGS } from "@upm/config/site-cache-tags";
import { createAnonClient } from "@upm/db/server";

import { modoForcado, type LaunchMode } from "./launch-mode-override";

/**
 * O modo do site público (P2-05 · 03 §1.1 e F14)
 * =========================================================================
 * `launch_mode` é a flag que o Admin troca em *Definições* (P8-05, com modal
 * de confirmação e step-up 2FA). `pre` mostra a pré-inscrição e a secção "Em
 * breve"; `post` abre o Market público e os imóveis recentes.
 *
 * **O defeito que esta função fecha.** `saveFeatureFlag`, em `apps/interno`,
 * chama `revalidatePath("/", "layout")` — mas corre noutra app Next. São três
 * processos independentes, e essa chamada nunca revalidou nada no `www`: o
 * interruptor parecia funcionar e o site não mudava. Ficou registado na nota
 * da Fase 2 do doc 06 quando foi encontrado.
 *
 * A saída é a tag: a leitura fica em cache sob `launch-mode`, e a rota
 * `/api/revalidate/launch-mode` — chamada pelo interno ao guardar — invalida-a
 * do lado de cá. Uma tag atravessa apps porque é o `www` que a possui; um
 * `revalidatePath` noutro processo não.
 *
 * `revalidate: 60` é a rede de segurança: mesmo que a chamada de invalidação
 * se perca, o site corrige-se sozinho dentro de um minuto. Um site público
 * preso no modo errado é pior do que uma leitura por minuto.
 */

export type { LaunchMode };

export const LAUNCH_MODE_TAG = SITE_CACHE_TAGS.launchMode;

const read = unstable_cache(
  async (): Promise<LaunchMode> => {
    // Sem cookies: o modo é o mesmo para toda a gente, e passar a sessão
    // tornaria a resposta impossível de partilhar em cache.
    const supabase = createAnonClient();
    const { data, error } = await supabase
      .from("feature_flags")
      .select("value")
      .eq("key", "launch_mode")
      .maybeSingle();

    if (error || !data) return "pre";
    // `jsonb` — chega como `"pre"` ou `"post"`.
    return data.value === "post" ? "post" : "pre";
  },
  ["launch-mode"],
  { tags: [LAUNCH_MODE_TAG], revalidate: 60 },
);

/**
 * Falha fechada em `pre`: se a leitura rebentar, o site mostra a versão de
 * pré-lançamento. Abrir o produto por acidente é o erro caro; mostrar a
 * pré-inscrição a mais um dia não é.
 */
export async function getLaunchMode(): Promise<LaunchMode> {
  const forcado = modoForcado();
  if (forcado) return forcado;
  try {
    return await read();
  } catch {
    return "pre";
  }
}

/**
 * A guarda das Server Actions que só existem depois do lançamento.
 * ---------------------------------------------------------------------------
 * O middleware manda de volta quem abrir `/criar-conta` em `pre`, mas uma
 * Server Action não precisa da página: o Next encaminha-a pelo identificador,
 * e um `POST /` com o `Next-Action` do registo corre-a na mesma. Por isso a
 * ação verifica o modo ela própria, no servidor, e em `pre` devolve quem a
 * chamou à página de pré-lançamento sem fazer nada.
 */
export async function soDepoisDoLancamento(): Promise<void> {
  if ((await getLaunchMode()) === "pre") redirect("/" as Route);
}
