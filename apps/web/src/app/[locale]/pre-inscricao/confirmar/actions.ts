"use server";

import { z } from "zod";
import { createAnonClient } from "@upm/db/server";

import type { ConfirmState } from "./confirmState";

export type { ConfirmState };

/**
 * O segundo passo do double opt-in (P2-02)
 * =========================================================================
 * `confirm_site_lead` compara o **hash** do token, nunca o token, e é
 * idempotente: confirmar duas vezes com o mesmo link devolve sucesso, porque
 * quem clica outra vez não fez nada de errado.
 *
 * **Confirma-se por POST, não por GET.** O link do e-mail abre uma página com
 * um botão, e é o botão que escreve. Um link que confirmasse ao ser aberto era
 * mais curto de usar e deixava de servir para o que `confirmed_at` existe: a
 * migração do intake chama-lhe *"a prova de consentimento que o RGPD pede"*, e
 * os verificadores de ligações dos clientes de e-mail e dos antivírus abrem os
 * links das mensagens sozinhos. Uma confirmação assinada por um robô não é
 * prova de consentimento de ninguém.
 *
 * O cliente é `anon`: quem confirma não tem sessão, e a função é
 * `security definer`.
 */

const tokenSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-f]{64}$/);

export async function confirmPreRegistration(
  _previous: ConfirmState,
  formData: FormData,
): Promise<ConfirmState> {
  // O token tem forma conhecida — 32 bytes em hexadecimal, de
  // `encode(gen_random_bytes(32), 'hex')`. Um valor com outra forma não chega
  // a tocar na base de dados.
  const parsed = tokenSchema.safeParse(formData.get("token"));
  if (!parsed.success) return { failed: true };

  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc("confirm_site_lead", { p_token: parsed.data });

  // Um token que já foi usado uma vez também cai aqui: o primeiro uso apaga o
  // hash, e a partir daí a função não o encontra. É indistinguível de um token
  // inventado, e tem de ser — dizer "este já foi usado" confirmaria a um
  // estranho que aquele token existiu.
  if (error || data !== true) return { failed: true };

  return { ok: true };
}
