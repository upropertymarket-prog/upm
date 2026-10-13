import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Env } from "./env.ts";
import type { MailDatabase } from "@upm/db/pending";

/**
 * O cliente do worker — `service_role`, sem sessão e sem refresh.
 *
 * `persistSession: false` e `autoRefreshToken: false` porque não há utilizador
 * nenhum: a chave é a identidade, e um refresh em background num processo de
 * longa duração só acrescenta uma coisa que pode falhar às três da manhã.
 */
export type MailWorkerClient = SupabaseClient<MailDatabase>;

export function createServiceClient(env: Env): MailWorkerClient {
  return createClient<MailDatabase>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type MailboxRow = MailDatabase["public"]["Tables"]["mailboxes"]["Row"];

/** As caixas que o worker tenta sincronizar: ativas e já com credencial. */
export async function listSyncableMailboxes(client: MailWorkerClient): Promise<MailboxRow[]> {
  const { data, error } = await client
    .from("mailboxes")
    .select("*")
    .eq("status", "active")
    .not("secret_id", "is", null)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Não foi possível listar as caixas: ${error.message}`);
  return data ?? [];
}

export async function getMailbox(
  client: MailWorkerClient,
  mailboxId: string,
): Promise<MailboxRow | null> {
  const { data, error } = await client
    .from("mailboxes")
    .select("*")
    .eq("id", mailboxId)
    .maybeSingle();

  if (error) throw new Error(`Não foi possível ler a caixa: ${error.message}`);
  return data ?? null;
}

/**
 * A palavra-passe, pela única porta que existe (`mailbox_credential`, com
 * `grant` só para a `service_role`). O Vault não é alcançável por `select`.
 */
export async function getMailboxPassword(
  client: MailWorkerClient,
  mailboxId: string,
): Promise<string | null> {
  const { data, error } = await client.rpc("mailbox_credential", { p_mailbox_id: mailboxId });
  if (error) throw new Error(`Não foi possível ler a credencial: ${error.message}`);
  return data ?? null;
}

/**
 * O resultado de uma sincronização, escrito na própria caixa — é o que o ecrã
 * do Admin mostra na coluna "Estado".
 *
 * Um erro põe a caixa em `error` e guarda a mensagem do servidor; **nunca a
 * credencial**, e por isso a mensagem é truncada e vem do erro do protocolo,
 * não de um `JSON.stringify` do que lhe foi passado.
 */
export async function recordSyncOutcome(
  client: MailWorkerClient,
  mailboxId: string,
  outcome: { ok: true } | { ok: false; error: string },
): Promise<void> {
  const patch = outcome.ok
    ? { status: "active" as const, last_sync_at: new Date().toISOString(), last_error: null }
    : { status: "error" as const, last_error: outcome.error.slice(0, 500) };

  const { error } = await client.from("mailboxes").update(patch).eq("id", mailboxId);
  if (error) throw new Error(`Não foi possível registar o estado da caixa: ${error.message}`);
}
