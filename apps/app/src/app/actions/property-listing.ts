"use server";

import { cookies } from "next/headers";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { SITE_CACHE_TAGS, invalidarCacheDoSite, listingTag } from "@upm/config/site-cache";
import { createClient } from "@upm/db/server";

/**
 * Ações de gestão de "As minhas propriedades" (P4-03).
 * =========================================================================
 * Ficheiro próprio, separado de `actions/properties.ts` (formulário "Nova
 * propriedade", em desenvolvimento em paralelo) — só esta ação de arquivar
 * vive aqui, para não colidir com esse trabalho.
 */

export type ArchivePropertyState = { archived?: boolean; error?: string };

/**
 * Arquiva um imóvel do próprio dono. Posse confirmada duas vezes: `eq` na
 * query (08 §7.3) e a RLS de `properties` por baixo, que só deixa o dono ou
 * staff escrever na linha.
 */
export async function archiveProperty(propertyId: string): Promise<ArchivePropertyState> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  const { error } = await supabase
    .from("properties")
    .update({ status: "archived" })
    .eq("id", propertyId)
    .eq("owner_id", user.id);

  if (error) return { error: "Não foi possível arquivar o imóvel. Tente novamente." };

  revalidatePath("/propriedades");
  // Arquivado sai do site público: pede-se ao `www`, que o tem em cache (F2).
  after(() => invalidarCacheDoSite([SITE_CACHE_TAGS.listings, listingTag(propertyId)]));
  return { archived: true };
}
