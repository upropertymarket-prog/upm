"use server";

import { cookies } from "next/headers";
import { createClient } from "@upm/db/server";
import { appUpdatesForMe, markAppUpdateSeen } from "@upm/db/updates";
import type { AppUpdate } from "@upm/ui";

/**
 * As novidades desta conta (P10-07 · 04 §8.1.3)
 * =========================================================================
 * **A audiência resolve-se no servidor.** `app_updates_for_me()` devolve só as
 * publicadas, do público de quem pergunta e ainda não vistas — a app nunca
 * recebe as que não lhe dizem respeito. É a mesma regra das audiências de
 * campanha (07 §24.6 #5), e tem a mesma razão: o que a app não recebe não pode
 * ser lido no payload por quem abra as ferramentas do browser.
 *
 * As imagens saem daqui como **URL assinado**, não como caminho: o bucket
 * `app-updates` é privado, e a alternativa era deixá-lo público e dar o
 * conteúdo de uma novidade **agendada** a quem adivinhasse o caminho — e uma
 * novidade é muitas vezes o anúncio de algo que ainda não saiu.
 *
 * ## Não há guarda de modo de demonstração, e isso é deliberado
 *
 * 04 §8.1.3 diz "nunca abre em modo demonstração (`?demo=1`)". Essa rota
 * **deixou de existir**: 07 §7 revogou-a e a demonstração do site passou a ser
 * uma montagem com componentes de `@upm/ui` e dados de `@upm/ui/demo-data`,
 * sem sessão e sem cliente Supabase. Sem sessão, `app_updates_for_me()`
 * devolve vazio por construção — o requisito está cumprido por não haver nada
 * a cumprir, e não por um `if` a testar um parâmetro que ninguém envia.
 */

/** 30 minutos: a mesma ordem de grandeza da vida de um modal aberto. */
const IMAGE_TTL_SECONDS = 1800;

export async function myAppUpdates(): Promise<AppUpdate[]> {
  const supabase = createClient(await cookies());
  const rows = await appUpdatesForMe(supabase);
  if (rows.length === 0) return [];

  const paths = rows.map((row) => row.imagePath).filter((path): path is string => Boolean(path));

  // Uma chamada para todas as imagens em vez de uma por novidade.
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await supabase.storage
      .from("app-updates")
      .createSignedUrls(paths, IMAGE_TTL_SECONDS);
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl);
    }
  }

  return rows.map((row) => ({
    id: row.id,
    version: row.version,
    title: row.title,
    bodyHtml: row.bodyHtml,
    points: row.points,
    imageUrl: row.imagePath ? (signed.get(row.imagePath) ?? null) : null,
    imageAlt: row.imageAlt,
    delivery: row.delivery,
  }));
}

/**
 * "Entendi". **O "Mais tarde" não chama isto** — é por não escrever nada que a
 * novidade volta no próximo login (04 §8.1.3).
 */
export async function acknowledgeAppUpdate(id: unknown): Promise<{ ok?: boolean; error?: string }> {
  if (typeof id !== "string") return { error: "Pedido inválido." };

  const supabase = createClient(await cookies());
  try {
    await markAppUpdateSeen(supabase, id);
    return { ok: true };
  } catch {
    // Silencioso de propósito no ecrã: falhar a marcar uma novidade como vista
    // tem como pior consequência voltar a mostrá-la, e um toast de erro sobre
    // isso assustava sem informar.
    return { error: "Não foi possível registar a leitura." };
  }
}
