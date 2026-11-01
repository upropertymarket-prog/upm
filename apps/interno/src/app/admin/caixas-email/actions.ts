"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Constants } from "@upm/db";
import { PORTAS_ENTRADA, PORTAS_SMTP, hostLooksInternal } from "@upm/config/security";
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

/**
 * O anfitrião é escrito à mão e o nosso servidor liga-se-lhe (12 §5.5)
 * ---------------------------------------------------------------------------
 * Estes dois campos decidem a que máquina o `mail-worker` abre um socket. Sem
 * filtro, `localhost`, `10.0.0.5` ou `169.254.169.254` — o endereço de
 * metadados, que em várias clouds devolve credenciais — são destinos válidos.
 *
 * E o "Testar ligação" devolve erros **distintos por lado**, o que é
 * precisamente o que um scanner de portas precisa de saber: sem isto, este
 * ecrã é um mapeador da rede interna com interface gráfica.
 *
 * Isto apanha o caso óbvio **no formulário**, para quem está a configurar ter
 * um erro imediato em vez de um timeout três minutos depois. A defesa a sério
 * é no worker, depois de resolver o nome — um domínio público pode apontar
 * para `127.0.0.1`, e é assim que o DNS rebinding funciona.
 */
const hostSchema = (campo: string) =>
  z
    .string()
    .trim()
    .min(1, `O servidor ${campo} é obrigatório.`)
    .max(255)
    .refine((host) => !hostLooksInternal(host), {
      message: "Este servidor aponta para a rede interna. Use o anfitrião do fornecedor.",
    });

/**
 * Lista branca e não intervalo: deixar passar qualquer porta de 1 a 65535 é o
 * que torna o teste de ligação útil a quem quer mapear a rede.
 */
const portaSchema = (permitidas: readonly number[]) =>
  z.coerce
    .number()
    .int()
    .refine((porta) => permitidas.includes(porta), {
      message: `Porta não permitida. Use uma de: ${permitidas.join(", ")}.`,
    });

const saveSchema = z.object({
  id: z.string().uuid().optional(),
  address: z.string().trim().email("Endereço de e-mail inválido.").max(320),
  displayName: z.string().trim().max(200).optional(),
  protocol: z.enum(["imap", "pop3"]),
  inHost: hostSchema("de entrada"),
  inPort: portaSchema(PORTAS_ENTRADA),
  inSecurity: securitySchema,
  smtpHost: hostSchema("SMTP"),
  smtpPort: portaSchema(PORTAS_SMTP),
  smtpSecurity: securitySchema,
  username: z.string().trim().min(1, "O utilizador é obrigatório.").max(320),
  // Do enum gerado: a lista à mão não tinha `marketing` (D64, 21 out 2026).
  department: z.enum(Constants.public.Enums.staff_department),
  ownerProfileId: z.string().uuid().nullable().optional(),
  status: z.enum(Constants.public.Enums.mailbox_status).optional(),
});

const secretSchema = z.object({
  id: z.string().uuid(),
  // Sem máximo baixo: algumas caixas usam palavras-passe de aplicação longas,
  // e recusá-las aqui seria inventar um limite que o servidor não tem.
  password: z.string().min(1, "A palavra-passe não pode ser vazia.").max(1024),
});

export type MailboxActionResult = { ok?: boolean; error?: string; notice?: string };
export type MailboxSaveInput = z.input<typeof saveSchema>;

/**
 * A resposta do `POST /mailboxes/:id/test` do worker. Escrita aqui à mão e não
 * importada de `@upm/mail-worker`: o worker é um processo à parte, com
 * dependências próprias (`imapflow`, `nodemailer`), e importar o seu módulo
 * para dentro do bundle do Next arrastaria tudo isso atrás. O contrato é o
 * JSON, não o tipo.
 */
type ConnectionCheck = {
  imap: { ok: boolean; error?: string };
  smtp: { ok: boolean; error?: string };
};

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
 * Testar ligação — o pedido vai ao mail-worker, que é quem tem credencial.
 *
 * O teste real é um IMAP `LOGIN` e um SMTP `EHLO`+`AUTH`, e isso é trabalho do
 * `apps/mail-worker` (02 §3.2): corre fora do Next e é o único processo com
 * `service_role` para ler o segredo do Vault. Fazer o teste a partir daqui
 * obrigaria a app do Admin a abrir ligações IMAP e a ter a chave de serviço no
 * seu ambiente — as duas coisas que a arquitetura separa de propósito.
 *
 * Esta action é por isso um intermediário com três responsabilidades e nenhuma
 * mais: confirmar que quem pede é admin, falar com o worker e traduzir a
 * resposta. **A palavra-passe não passa por aqui** — nem à ida, nem à volta.
 *
 * **As duas pontas respondem em separado** porque falham em separado: o que
 * costuma estar errado é a porta de saída, e "não foi possível ligar" mandaria
 * rever seis campos para corrigir um.
 */
export async function testMailboxConnection(mailboxId: unknown): Promise<MailboxActionResult> {
  if (typeof mailboxId !== "string" || !z.string().uuid().safeParse(mailboxId).success) {
    return { error: "Caixa inválida." };
  }

  const supabase = await getAdminClient();
  if (!supabase) return { error: "Sem permissão para gerir caixas de e-mail." };

  const workerUrl = process.env.MAIL_WORKER_URL;
  const workerToken = process.env.MAIL_WORKER_TOKEN;
  if (!workerUrl || !workerToken) {
    return {
      error:
        "O mail-worker ainda não está configurado (MAIL_WORKER_URL e MAIL_WORKER_TOKEN). A ligação não pode ser testada a partir daqui.",
    };
  }

  let payload: ConnectionCheck;
  try {
    // Com limite de tempo: um servidor de correio que não responde deixa um
    // `fetch` pendurado até ao timeout do Node, e o botão do ecrã ficaria a
    // girar sem fim. 20 s chega para um `LOGIN` lento e é pouco para cansar.
    const response = await fetch(`${workerUrl.replace(/\/$/, "")}/mailboxes/${mailboxId}/test`, {
      method: "POST",
      headers: { authorization: `Bearer ${workerToken}` },
      signal: AbortSignal.timeout(20_000),
    });

    const body = (await response.json().catch(() => null)) as
      (Partial<ConnectionCheck> & { error?: string }) | null;

    if (!response.ok) {
      return { error: body?.error ?? `O mail-worker respondeu ${response.status}.` };
    }
    if (!body?.imap || !body?.smtp) {
      return { error: "Resposta inesperada do mail-worker." };
    }
    payload = { imap: body.imap, smtp: body.smtp };
  } catch {
    return { error: "Não foi possível falar com o mail-worker." };
  }

  await writeAuditLog(supabase, {
    action: "mailbox.test",
    entity: "mailboxes",
    entityId: mailboxId,
    diff: { imap: payload.imap.ok, smtp: payload.smtp.ok },
  });

  if (payload.imap.ok && payload.smtp.ok) {
    return { ok: true, notice: "Entrada e saída ligaram sem erros." };
  }

  const problems = [
    payload.imap.ok ? null : `Entrada: ${payload.imap.error ?? "falhou"}`,
    payload.smtp.ok ? null : `Saída (SMTP): ${payload.smtp.error ?? "falhou"}`,
  ].filter(Boolean);

  return { error: problems.join(" · ") };
}
