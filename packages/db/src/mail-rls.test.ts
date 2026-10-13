/**
 * Fase 10 · Parte 2 — a caixa de e-mail (08 §2.3).
 *
 * Uma linha da matriz de acesso por cada tabela nova — `mail_threads`,
 * `mail_messages` e `mail_labels` — mais as três regras que vivem na base de
 * dados e que nenhum teste de ecrã apanharia:
 *
 *  1. **Ninguém escreve `mail_messages` diretamente.** É a regra que impede
 *     reescrever o `html` ou o remetente de um e-mail recebido — falsificar
 *     prova numa caixa que serve para resolver disputas com clientes.
 *  2. **A credencial não é alcançável a partir de uma sessão.**
 *     `mailbox_credential()` tem `grant` só para a `service_role`.
 *  3. **O Admin lê, o Suporte trabalha.** Como em `/admin/tickets` (07 §5.10).
 *
 * Os fixtures nascem com `service_role`; as tentativas são feitas com sessões
 * `anon`, `buyer`, `support` e `admin`. Salta inteiro sem credenciais de
 * staging (D13) — e, por decisão do cliente, estes testes correm no fim do
 * projeto, não fase a fase.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasEnv = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

const PASSWORD = "phase10-mail-test-P@ss1";
const USERS = {
  admin: { email: "phase10-mail-admin@upropertymarket.test", role: "admin" },
  support: { email: "phase10-mail-support@upropertymarket.test", role: "support" },
  buyer: { email: "phase10-mail-buyer@upropertymarket.test", role: "buyer" },
} as const;

type Role = keyof typeof USERS | "anon";

const STAMP = Date.now();
const ADDRESS = `teste-${STAMP}@upropertymarket.test`;
const MESSAGE_ID = `<teste-${STAMP}@upropertymarket.test>`;

describe.skipIf(!hasEnv)("Fase 10 · Parte 2 — caixa de e-mail: matriz RLS e regras", () => {
  let service: SupabaseClient;
  const clients = {} as Record<Role, SupabaseClient>;
  let mailboxId = "";
  let messageId = "";
  let labelId = "";

  async function getOrCreateUser(email: string, role: string) {
    const { data: users, error } = await service.auth.admin.listUsers();
    if (error) throw new Error(`Falha a listar utilizadores: ${error.message}`);
    const found = users.users.find((user) => user.email === email);
    if (found) return found.id;

    const { data, error: createError } = await service.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { role },
    });
    if (createError || !data.user)
      throw new Error(`Falha a criar ${email}: ${createError?.message}`);
    return data.user.id;
  }

  beforeAll(async () => {
    service = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);
    clients.anon = createClient(SUPABASE_URL!, ANON_KEY!);

    for (const role of Object.keys(USERS) as (keyof typeof USERS)[]) {
      const fixture = USERS[role];
      const id = await getOrCreateUser(fixture.email, fixture.role);
      const { error } = await service
        .from("profiles")
        .update({ role: fixture.role, status: "active" })
        .eq("id", id);
      if (error) throw new Error(`Falha a preparar ${role}: ${error.message}`);

      const client = createClient(SUPABASE_URL!, ANON_KEY!);
      const { error: signInError } = await client.auth.signInWithPassword({
        email: fixture.email,
        password: PASSWORD,
      });
      if (signInError) throw new Error(`Falha a autenticar ${fixture.email}`);
      clients[role] = client;
    }

    const mailbox = await service
      .from("mailboxes")
      .insert({
        address: ADDRESS,
        display_name: "Caixa de teste",
        in_host: "imap.exemplo.test",
        in_port: 993,
        smtp_host: "smtp.exemplo.test",
        smtp_port: 587,
        username: ADDRESS,
      })
      .select("id")
      .single();
    if (mailbox.error) throw new Error(`Falha a criar a caixa: ${mailbox.error.message}`);
    mailboxId = mailbox.data.id;

    const message = await service
      .from("mail_messages")
      .insert({
        mailbox_id: mailboxId,
        message_id: MESSAGE_ID,
        from_address: "cliente@exemplo.test",
        from_name: "Cliente de Teste",
        subject: "Não consigo publicar o anúncio",
        text_body: "Carreguei em publicar e não aconteceu nada.",
        html: "<p>Carreguei em publicar e não aconteceu nada.</p>",
      })
      .select("id")
      .single();
    if (message.error) throw new Error(`Falha a criar a mensagem: ${message.error.message}`);
    messageId = message.data.id;

    const label = await service
      .from("mail_labels")
      .insert({ mailbox_id: mailboxId, name: `urgente-${STAMP}`, color: "danger" })
      .select("id")
      .single();
    if (label.error) throw new Error(`Falha a criar o marcador: ${label.error.message}`);
    labelId = label.data.id;
  });

  afterAll(async () => {
    if (!service) return;
    await service.from("tickets").delete().eq("fingerprint", `mail:${MESSAGE_ID}`);
    // As mensagens, conversas e marcadores caem por `on delete cascade`.
    await service.from("mailboxes").delete().eq("id", mailboxId);
  });

  // -------------------------------------------------------------------------
  // Leitura
  // -------------------------------------------------------------------------

  it("anon não lê correio nenhum", async () => {
    const { data } = await clients.anon.from("mail_messages").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("um comprador autenticado também não lê", async () => {
    const { data } = await clients.buyer.from("mail_messages").select("id").eq("id", messageId);
    expect(data ?? []).toHaveLength(0);
  });

  it("o Suporte e o Admin leem a mensagem", async () => {
    for (const role of ["support", "admin"] as const) {
      const { data } = await clients[role].from("mail_messages").select("id").eq("id", messageId);
      expect(data ?? []).toHaveLength(1);
    }
  });

  it("o Suporte passa a ver a lista de caixas (P10-04)", async () => {
    const { data } = await clients.support.from("mailboxes").select("id").eq("id", mailboxId);
    expect(data ?? []).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // Escrita — nenhuma é direta
  // -------------------------------------------------------------------------

  it("o Suporte NÃO pode reescrever o corpo nem o remetente de um e-mail", async () => {
    const { error } = await clients.support
      .from("mail_messages")
      .update({ html: "<p>outra coisa</p>", from_address: "outro@exemplo.test" })
      .eq("id", messageId);
    expect(error).not.toBeNull();
  });

  it("marcar como lida passa pela função, e funciona", async () => {
    const { error } = await clients.support.rpc("mail_set_flags", {
      p_message_id: messageId,
      p_is_read: true,
    });
    expect(error).toBeNull();

    const { data } = await service
      .from("mail_messages")
      .select("is_read")
      .eq("id", messageId)
      .single();
    expect(data?.is_read).toBe(true);
  });

  it("o Admin não escreve na caixa — o trabalho é do Suporte", async () => {
    const { error } = await clients.admin.rpc("mail_set_flags", {
      p_message_id: messageId,
      p_is_starred: true,
    });
    expect(error).not.toBeNull();
  });

  it("arquivar só aceita entrada e arquivo", async () => {
    const ok = await clients.support.rpc("mail_move", {
      p_message_id: messageId,
      p_folder: "archive",
    });
    expect(ok.error).toBeNull();

    const nope = await clients.support.rpc("mail_move", {
      p_message_id: messageId,
      p_folder: "sent",
    });
    expect(nope.error).not.toBeNull();

    await clients.support.rpc("mail_move", { p_message_id: messageId, p_folder: "inbox" });
  });

  it("recusa um marcador de outra caixa", async () => {
    const other = await service
      .from("mailboxes")
      .insert({
        address: `outra-${STAMP}@upropertymarket.test`,
        in_host: "imap.exemplo.test",
        in_port: 993,
        smtp_host: "smtp.exemplo.test",
        smtp_port: 587,
        username: `outra-${STAMP}@upropertymarket.test`,
      })
      .select("id")
      .single();

    const alheio = await service
      .from("mail_labels")
      .insert({ mailbox_id: other.data!.id, name: `alheio-${STAMP}` })
      .select("id")
      .single();

    const { error } = await clients.support.rpc("mail_set_labels", {
      p_message_id: messageId,
      p_labels: [alheio.data!.id],
    });
    expect(error).not.toBeNull();

    await service.from("mailboxes").delete().eq("id", other.data!.id);
  });

  it("aceita um marcador da própria caixa", async () => {
    const { error } = await clients.support.rpc("mail_set_labels", {
      p_message_id: messageId,
      p_labels: [labelId],
    });
    expect(error).toBeNull();

    const { data } = await service
      .from("mail_messages")
      .select("labels")
      .eq("id", messageId)
      .single();
    expect(data?.labels).toContain(labelId);
  });

  // -------------------------------------------------------------------------
  // A credencial
  // -------------------------------------------------------------------------

  it("nem o Admin consegue ler a credencial da caixa", async () => {
    const { error } = await clients.admin.rpc("mailbox_credential", { p_mailbox_id: mailboxId });
    expect(error).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // Criar ticket a partir do e-mail
  // -------------------------------------------------------------------------

  it("cria o ticket sem reporter e liga-o à mensagem", async () => {
    const { data, error } = await clients.support.rpc("create_ticket_from_mail", {
      p_message_id: messageId,
    });
    expect(error).toBeNull();
    const ticket = data?.[0];
    expect(ticket?.created).toBe(true);

    const { data: row } = await service
      .from("tickets")
      .select("reporter_id, fingerprint, description")
      .eq("id", ticket!.id)
      .single();

    // Quem escreveu para o suporte não tem conta: o ticket não finge que tem.
    expect(row?.reporter_id).toBeNull();
    expect(row?.fingerprint).toBe(`mail:${MESSAGE_ID}`);
    expect(row?.description).toContain("cliente@exemplo.test");

    const { data: message } = await service
      .from("mail_messages")
      .select("ticket_id")
      .eq("id", messageId)
      .single();
    expect(message?.ticket_id).toBe(ticket!.id);
  });

  it("carregar duas vezes devolve o mesmo ticket, não cria um segundo", async () => {
    const { data } = await clients.support.rpc("create_ticket_from_mail", {
      p_message_id: messageId,
    });
    expect(data?.[0]?.created).toBe(false);

    const { data: all } = await service
      .from("tickets")
      .select("id")
      .eq("fingerprint", `mail:${MESSAGE_ID}`);
    expect(all ?? []).toHaveLength(1);
  });

  it("um comprador não cria tickets a partir do correio", async () => {
    const { error } = await clients.buyer.rpc("create_ticket_from_mail", {
      p_message_id: messageId,
    });
    expect(error).not.toBeNull();
  });
});
