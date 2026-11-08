"use server";

import { z } from "zod";
import { createAnonClient } from "@upm/db/server";

import type { RemoveState } from "./removeState";

export type { RemoveState };

/**
 * Apagar a pré-inscrição, a pedido de quem a fez (8 nov 2026)
 * =========================================================================
 * O link vem no e-mail de confirmação. `remove_site_lead` apaga o lead, as
 * notas da equipa sobre ele e os e-mails de confirmação na fila, e deixa no
 * `audit_log` só que um lead foi apagado a pedido (sem nome nem e-mail).
 *
 * **Por POST, não ao abrir o link** — a mesma razão da confirmação: os
 * antivírus e os clientes de e-mail abrem os links das mensagens sozinhos, e
 * aqui o efeito apaga dados e não se desfaz.
 *
 * O cliente é `anon`, como na confirmação: quem pede não tem sessão, e o
 * token é a identidade — só quem recebeu o e-mail o tem.
 */

const tokenSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-f]{64}$/);

export async function removePreRegistration(
  _previous: RemoveState,
  formData: FormData,
): Promise<RemoveState> {
  const parsed = tokenSchema.safeParse(formData.get("token"));
  if (!parsed.success) return { failed: true };

  const { data, error } = await createAnonClient().rpc("remove_site_lead", {
    p_token: parsed.data,
  });

  // Um link já usado cai aqui: o primeiro uso apagou a linha. É
  // indistinguível de um token inventado, e tem de ser.
  if (error || data !== true) return { failed: true };
  return { ok: true };
}
