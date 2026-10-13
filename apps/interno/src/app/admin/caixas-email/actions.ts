"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@upm/db/server";
import { writeAuditLog } from "@upm/db/audit";

/**
 * Caixas de e-mail do Suporte (P10-03 · 04 §2.5 · 05 §1.8)
 * =========================================================================
 * Três operações: guardar a configuração da caixa, guardar a palavra-passe e
 * testar a ligação. São três e não uma porque têm riscos diferentes — e a do
 * meio é a única que toca num segredo.
 *
 * **A verificação de papel está nos dois lados**, como em todas as mutações
 * deste projeto: aqui, para dar uma mensagem útil, e na RLS da tabela e dentro
 * de `save_mailbox_secret()`, que é `security definer` e tem de se defender
 * sozinha de quem chame o RPC diretamente.
 *
 * ## A palavra-passe nunca passa por aqui duas vezes
 *
 * `saveMailboxSecret` recebe-a, entrega-a ao RPC e esquece-a. Não a guarda em
 * estado, não a devolve, não a regista no `audit_log` — o registo diz que uma
 * credencial foi mudada, e **qual** caixa, nunca o valor. Pela mesma razão não
 * existe nenhuma action que leia a palavra-passe: o ecrã mostra "definida" ou
 * "por definir", e quem precisa do valor é o mail-worker, com `service_role`.
 */

const securitySchema = z.enum(["ssl_tls", "starttls", "none"]);

const saveSchema = z.object({
  id: z.string().uuid().optional(),
  address: z.string().trim().email("Endereço de e-mail inválido.").max(320),
  displayName: z.string().trim().max(200).optional(),
  protocol: z.enum(["imap", "pop3"]),
  inHost: z.string().trim().min(1, "O servidor de entrada é obrigatório.").max(255),
  inPort: z.coerce.number().int().min(1).max(65535),
  inSecurity: securitySchema,
  smtpHost: z.string().trim().min(1, "O servidor SMTP é obrigatório.").max(255),
  smtpPort: z.coerce.number().int().min(1).max(65535),
  smtpSecurity: securitySchema,
  username: z.string().trim().min(1, "O utilizador é obrigatório.").max(320),
  department: z.enum(["suporte", "financeiro", "moderacao", "admin"]),
  ownerProfileId: z.string().uuid().nullable().optional(),
  status: z.enum(["active", "paused", "error"]).optional(),
});

const secretSchema = z.object({
  id: z.string().uuid(),
  // Sem máximo baixo: algumas caixas usam palavras-passe de aplicação longas,
  // e recusá-las aqui seria inventar um limite que o servidor não tem.
  password: z.string().min(1, "A palavra-passe não pode ser vazia.").max(1024),
});

export type MailboxActionResult = { ok?: boolean; error?: string; notice?: string };
export type MailboxSaveInput = z.input<typeof saveSchema>;

async function getAdminClient() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return profile?.role === "admin" ? supabase : null;
}

export async function saveMailbox(input: unknown): Promise<MailboxActionResult> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados da caixa inválidos." };
  }

  const supabase = await getAdminClient();
  if (!supabase) return { error: "Sem permissão para gerir caixas de e-mail." };

  const v = parsed.data;
  const row = {
    address: v.address,
    display_name: v.displayName?.trim() ?? "",
    protocol: v.protocol,
    in_host: v.inHost,
    in_port: v.inPort,
    in_security: v.inSecurity,
    smtp_host: v.smtpHost,
    smtp_port: v.smtpPort,
    smtp_security: v.smtpSecurity,
    username: v.username,
    department: v.department,
    owner_profile_id: v.ownerProfileId ?? null,
    ...(v.status ? { status: v.status } : {}),
  };

  const { data, error } = v.id
    ? await supabase.from("mailboxes").update(row).eq("id", v.id).select("id").maybeSingle()
    : await supabase.from("mailboxes").insert(row).select("id").maybeSingle();

  if (error) {
    // 23505 é o índice único em `lower(address)`. A mensagem do Postgres fala
    // de um índice; quem está no ecrã precisa de saber o que fazer.
    if (error.code === "23505") {
      return { error: "Já existe uma caixa com este endereço." };
    }
    return { error: "Não foi possível guardar a caixa de e-mail." };
  }

  await writeAuditLog(supabase, {
    action: v.id ? "mailbox.updated" : "mailbox.created",
    entity: "mailboxes",
    entityId: data?.id ?? v.id ?? null,
    // O endereço e o servidor entram; a credencial não passa por aqui.
    diff: { address: v.address, in_host: v.inHost, smtp_host: v.smtpHost },
  });

  revalidatePath("/admin/caixas-email");
  return {
    ok: true,
    notice: v.id ? "Caixa atualizada." : "Caixa criada. Falta definir a palavra-passe.",
  };
}

/** A palavra-passe vai direta para o Vault pelo RPC — ver a nota do ficheiro. */
export async function saveMailboxSecret(input: unknown): Promise<MailboxActionResult> {
  const parsed = secretSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Palavra-passe inválida." };
  }

  const supabase = await getAdminClient();
  if (!supabase) return { error: "Sem permissão para gerir caixas de e-mail." };

  const { error } = await supabase.rpc("save_mailbox_secret", {
    p_mailbox_id: parsed.data.id,
    p_password: parsed.data.password,
  });

  if (error) {
    // O Vault pode não existir na instância (ver a migração). Vale a pena
    // distinguir, porque a correção é de infraestrutura e não do utilizador.
    if (error.message?.includes("Vault")) {
      return { error: "O Supabase Vault não está disponível nesta instância." };
    }
    return { error: "Não foi possível guardar a palavra-passe." };
  }

  await writeAuditLog(supabase, {
    action: "mailbox.secret_updated",
    entity: "mailboxes",
    entityId: parsed.data.id,
    // Deliberadamente sem `diff`: o que mudou é um segredo.
    diff: {},
  });

  revalidatePath("/admin/caixas-email");
  return { ok: true, notice: "Palavra-passe guardada." };
}

/**
 * Testar ligação — **ainda não liga a nada, e diz isso**.
 *
 * O teste real é um IMAP/POP3 `LOGIN` e um SMTP `EHLO`+`AUTH`, e isso é
 * trabalho do mail-worker (02 §3.2: `imapflow` / `node-pop3` + `nodemailer`),
 * que corre fora do Next — em Fly.io/Railway — e é o único processo com
 * `service_role` para ler o segredo do Vault. Fazer o teste a partir daqui
 * obrigaria a app do Admin a abrir ligações IMAP e a ter a chave de serviço no
 * seu ambiente: as duas coisas que a arquitetura separa de propósito.
 *
 * Fica a costura, com a resposta honesta. É melhor um "ainda não existe" do
 * que um botão que devolve verde sem ter testado nada — que é o pior resultado
 * possível num ecrã de credenciais.
 */
export async function testMailboxConnection(mailboxId: unknown): Promise<MailboxActionResult> {
  if (typeof mailboxId !== "string" || !z.string().uuid().safeParse(mailboxId).success) {
    return { error: "Caixa inválida." };
  }

  const supabase = await getAdminClient();
  if (!supabase) return { error: "Sem permissão para gerir caixas de e-mail." };

  const workerUrl = process.env.MAIL_WORKER_URL;
  if (!workerUrl) {
    return {
      error:
        "O mail-worker ainda não está configurado (MAIL_WORKER_URL). A ligação não pode ser testada a partir daqui.",
    };
  }

  return {
    error:
      "O teste de ligação entra com o mail-worker, em P10-03. A configuração já é guardada e a palavra-passe já vai para o Vault.",
  };
}
