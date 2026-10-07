"use server";

import { cookies } from "next/headers";
import { createClient, createServiceClient } from "@upm/db/server";
import { cancelReasonSchema } from "@upm/db/subscription";
import { getStripeClient } from "@upm/db/stripe";

/**
 * Zona de perigo — exportar e eliminar a conta (Fase 9, P9-06)
 * =========================================================================
 * Fecha a metade de D25 que faltava: 04 §8.3 dá a `/definicoes` cinco secções e
 * esta é a quinta. 02 §7.3 exige as duas operações — exportação e eliminação.
 *
 * A ordem da eliminação é esta, e importa:
 *
 *   1. `delete_own_account()` — anonimiza o perfil e CONSERVA o histórico de
 *      subscrições, faturas e aceitações. É a base de dados a decidir o que
 *      sobrevive, não este ficheiro.
 *   2. Stripe — `cancel_at_period_end`, a mesma regra de qualquer cancelamento
 *      (02 §9 e §8 dos Termos). Não há reembolso e não há cobrança nova.
 *   3. `auth.users` — e-mail anonimizado e utilizador banido. **Nunca apagado**:
 *      `profiles` tem `on delete cascade` sobre `auth.users`, e apagar levava o
 *      histórico de subscrições com ele — exatamente o que P9-06 proíbe.
 *   4. Sessão terminada.
 *
 * Se o passo 2 ou 3 falharem, a conta JÁ está anonimizada e o passo 1 ficou
 * registado em `account_deletions`. É o lado certo para falhar: mais vale uma
 * conta anonimizada com faturação a precisar de atenção manual do que uma
 * eliminação que não aconteceu e diz que aconteceu.
 */

async function session() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export type ExportState = { json?: string; error?: string };

export async function exportAccountData(): Promise<ExportState> {
  const { supabase, user } = await session();
  if (!user) return { error: "Sessão inválida." };

  const { data, error } = await supabase.rpc("export_own_account_data");
  if (error || !data) return { error: "Não foi possível exportar os dados. Tente novamente." };

  // O download é do lado do cliente, a partir desta string: o ficheiro nunca
  // passa pelo Storage, por isso não há objeto com dados pessoais a ficar lá
  // esquecido (08 §6.3).
  return { json: JSON.stringify(data, null, 2) };
}

export type DeleteAccountState = { ok?: boolean; error?: string };

export async function deleteOwnAccount(
  _prev: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  // Confirmação escrita, como qualquer ação irreversível. Não é um `confirm()`
  // do browser: tem de ser verificada no servidor, senão não é confirmação.
  if (formData.get("confirm") !== "ELIMINAR") {
    return { error: "Escreva ELIMINAR para confirmar." };
  }

  const reasonResult = cancelReasonSchema.safeParse(formData.get("reason") ?? undefined);
  if (!reasonResult.success) return { error: "Motivo demasiado longo." };

  const { supabase, user } = await session();
  if (!user) return { error: "Sessão inválida." };

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id")
    .in("status", ["active", "trialing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // `p_reason` é opcional nos tipos gerados (`p_reason?: string`), não
  // anulável — a mudança de forma do CLI 2.118 que o doc 10 §1.7 avisou.
  const { error } = await supabase.rpc("delete_own_account", {
    p_reason: reasonResult.data,
  });
  if (error) return { error: "Não foi possível eliminar a conta. Tente novamente." };

  if (subscription?.stripe_subscription_id) {
    try {
      await getStripeClient().subscriptions.update(subscription.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
    } catch {
      // Registado em `account_deletions`; a conta já está anonimizada. Não se
      // devolve erro: dizer "não foi possível eliminar" era falso.
      console.error("[account] eliminação feita, cancelamento no Stripe falhou");
    }
  }

  try {
    const service = createServiceClient();
    await service.auth.admin.updateUserById(user.id, {
      email: `deleted+${user.id}@deleted.invalid`,
      ban_duration: "876000h",
      user_metadata: {},
    });
  } catch {
    console.error("[account] eliminação feita, anonimização de auth.users falhou");
  }

  await supabase.auth.signOut();
  return { ok: true };
}
