"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@upm/db/server";
import { planLimitMessage } from "@upm/db/billing";
import { propertyFiltersSchema, type PropertyFilters } from "@upm/db/properties";

/**
 * CRUD de alertas de pesquisa (P4-04b). Só o CRUD — o envio de notificações
 * fica fora de âmbito desta fase.
 */

export type SearchAlertActionState = { ok?: boolean; error?: string };

export async function createSearchAlert(filters: PropertyFilters): Promise<SearchAlertActionState> {
  const parsed = propertyFiltersSchema.safeParse(filters);
  if (!parsed.success) return { error: "Filtros inválidos." };

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  const { error } = await supabase
    .from("search_alerts")
    .insert({ user_id: user.id, filters: parsed.data });
  if (error) return { error: planLimitMessage(error) ?? "Não foi possível criar o alerta." };

  revalidatePath("/guardados/alertas");
  return { ok: true };
}

export async function updateSearchAlert(
  id: string,
  filters: PropertyFilters,
): Promise<SearchAlertActionState> {
  const parsed = propertyFiltersSchema.safeParse(filters);
  if (!parsed.success) return { error: "Filtros inválidos." };

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  const { error } = await supabase
    .from("search_alerts")
    .update({ filters: parsed.data })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: "Não foi possível atualizar o alerta." };

  revalidatePath("/guardados/alertas");
  return { ok: true };
}

export async function deleteSearchAlert(id: string): Promise<SearchAlertActionState> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  const { error } = await supabase
    .from("search_alerts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: "Não foi possível apagar o alerta." };

  revalidatePath("/guardados/alertas");
  return { ok: true };
}
