"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@upm/db/server";
import { planLimitMessage } from "@upm/db/billing";

import type { ToggleSavedResult } from "../../components/market/SavedPropertyActions";

/**
 * Guardar/desguardar um imóvel (P4-04a/b). Só compradores têm `/guardados`
 * (07 §4.2), mas qualquer sessão pode guardar a partir do Market — a página
 * de Guardados é que é buyer-only, não a ação em si.
 */
export async function toggleSavedProperty(propertyId: string): Promise<ToggleSavedResult> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  const { data: existing } = await supabase
    .from("saved_properties")
    .select("id")
    .eq("user_id", user.id)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("saved_properties").delete().eq("id", existing.id);
    if (error) return { error: "Não foi possível desguardar o imóvel." };
    revalidatePath("/guardados");
    return { saved: false };
  }

  const { data: property } = await supabase
    .from("properties_public")
    .select("price_cents, rent_cents")
    .eq("id", propertyId)
    .maybeSingle();

  const { error } = await supabase.from("saved_properties").insert({
    user_id: user.id,
    property_id: propertyId,
    price_at_save_cents: property?.price_cents ?? property?.rent_cents ?? null,
  });
  // P7-03: o limite do plano é do gatilho, e a recusa explica-se (07 §19.8 #1).
  if (error) return { error: planLimitMessage(error) ?? "Não foi possível guardar o imóvel." };

  revalidatePath("/guardados");
  return { saved: true };
}
