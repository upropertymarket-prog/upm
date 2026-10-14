/**
 * Fase 10 · os anexos do correio (D66) — 08 §2.3.
 *
 * As quatro regras que vivem na base de dados e que nenhum teste de ecrã
 * apanharia:
 *
 *  1. **O bucket `mail-attachments` é do staff e mais ninguém.** Um anexo é um
 *     ficheiro que um estranho nos enviou, muitas vezes com dados de um cliente
 *     lá dentro: contrato, caderneta, recibo.
 *  2. **Ninguém escreve no bucket a partir de uma sessão.** Quem escreve é a
 *     `service_role`, e é o mesmo desenho de `mail_messages` — nenhum caminho
 *     da aplicação pode pôr outro ficheiro por cima do que o cliente enviou.
 *  3. **A Cloud interna tem porta própria.** `cloud_register_staff_file()` não
 *     cobra o ficheiro à quota do plano de quem está de turno, e exige
 *     `is_staff()` dentro da própria função (07 §20.5).
 *  4. **Guardar duas vezes não cria duas cópias.** Dois turnos a olhar para a
 *     mesma mensagem é normal; dois ficheiros iguais na Cloud não é.
 *
 * Os fixtures nascem com `service_role`. Salta inteiro sem credenciais de
 * staging (D13) — e, por decisão do cliente, estes testes correm no fim do
 * projeto, não fase a fase.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasEnv = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

const PASSWORD = "phase10-attach-test-P@ss1";
const USERS = {
  support: { email: "phase10-attach-support@upropertymarket.test", role: "support" },
  buyer: { email: "phase10-attach-buyer@upropertymarket.test", role: "buyer" },
} as const;

type Role = keyof typeof USERS | "anon";

const STAMP = Date.now();
const ADDRESS = `anexos-${STAMP}@upropertymarket.test`;
const MESSAGE_ID = `<anexos-${STAMP}@upropertymarket.test>`;
/** `%PDF-1.7` — tem de passar a assinatura de conteúdo, como um anexo a sério. */
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);

describe.skipIf(!hasEnv)("Fase 10 · anexos do correio: bucket, Cloud interna e duplicados", () => {
  let service: SupabaseClient;
  const clients = {} as Record<Role, SupabaseClient>;
  let mailboxId = "";
  let messageId = "";
  let attachmentPath = "";
  const cloudPaths: string[] = [];

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
        display_name: "Caixa de anexos",
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

    // O `id` vem de fora, como no worker: o caminho do anexo leva-o dentro.
    messageId = crypto.randomUUID();
    attachmentPath = `${mailboxId}/${messageId}/0-contrato.pdf`;

    const upload = await service.storage
      .from("mail-attachments")
      .upload(attachmentPath, PDF, { contentType: "application/pdf", upsert: true });
    if (upload.error) throw new Error(`Falha a subir o anexo: ${upload.error.message}`);

    const message = await service
      .from("mail_messages")
      .insert({
        id: messageId,
        mailbox_id: mailboxId,
        message_id: MESSAGE_ID,
        from_address: "cliente@exemplo.test",
        subject: "Contrato assinado",
        attachments: [
          {
            filename: "contrato.pdf",
            contentType: "application/pdf",
            size: PDF.byteLength,
            path: attachmentPath,
          },
        ],
      })
      .select("id")
      .single();
    if (message.error) throw new Error(`Falha a criar a mensagem: ${message.error.message}`);
  });

  afterAll(async () => {
    if (!service) return;
    await service.storage.from("mail-attachments").remove([attachmentPath]);
    if (cloudPaths.length > 0) await service.storage.from("cloud").remove(cloudPaths);
    await service.from("files").delete().eq("source", "mail_attachment").eq("name", "contrato.pdf");
    await service.from("mailboxes").delete().eq("id", mailboxId);
  });

  // -------------------------------------------------------------------------
  // O bucket
  // -------------------------------------------------------------------------

  it("anon não assina URL de um anexo", async () => {
    const { error } = await clients.anon.storage
      .from("mail-attachments")
      .createSignedUrl(attachmentPath, 60);
    expect(error).not.toBeNull();
  });

  it("um comprador autenticado também não", async () => {
    const { error } = await clients.buyer.storage
      .from("mail-attachments")
      .createSignedUrl(attachmentPath, 60);
    expect(error).not.toBeNull();
  });

  it("o Suporte assina e o URL devolve o ficheiro", async () => {
    const { data, error } = await clients.support.storage
      .from("mail-attachments")
      .createSignedUrl(attachmentPath, 60);
    expect(error).toBeNull();
    expect(data?.signedUrl).toBeTruthy();

    const response = await fetch(data!.signedUrl);
    expect(response.ok).toBe(true);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PDF);
  });

  it("nem o Suporte escreve no bucket — quem escreve é a service_role", async () => {
    const { error } = await clients.support.storage
      .from("mail-attachments")
      .upload(`${mailboxId}/${messageId}/9-falso.pdf`, PDF, { contentType: "application/pdf" });
    expect(error).not.toBeNull();
  });

  it("nem o Suporte apaga o que o cliente enviou", async () => {
    const { data } = await clients.support.storage
      .from("mail-attachments")
      .remove([attachmentPath]);
    // `remove` com a policy a recusar não apaga nada; o objeto continua lá.
    expect(data ?? []).toHaveLength(0);

    const { error } = await service.storage
      .from("mail-attachments")
      .createSignedUrl(attachmentPath, 60);
    expect(error).toBeNull();
  });

  // -------------------------------------------------------------------------
  // A Cloud interna
  // -------------------------------------------------------------------------

  it("um comprador não registra nada na Cloud interna", async () => {
    const { error } = await clients.buyer.rpc("cloud_register_staff_file", {
      p_name: "contrato.pdf",
      p_mime: "application/pdf",
      p_size: PDF.byteLength,
      p_storage_path: `${STAMP}/falso/1`,
      p_checksum: "0".repeat(64),
      p_source: "mail_attachment",
    });
    expect(error).not.toBeNull();
  });

  it("o Suporte guarda o anexo na Cloud, com scope staff e sem quota de plano", async () => {
    const {
      data: { user },
    } = await clients.support.auth.getUser();
    const storagePath = `${user!.id}/${crypto.randomUUID()}/1`;
    cloudPaths.push(storagePath);

    const upload = await clients.support.storage
      .from("cloud")
      .upload(storagePath, PDF, { contentType: "application/pdf" });
    expect(upload.error).toBeNull();

    const { data: fileId, error } = await clients.support.rpc("cloud_register_staff_file", {
      p_name: "contrato.pdf",
      p_mime: "application/pdf",
      p_size: PDF.byteLength,
      p_storage_path: storagePath,
      p_checksum: "a".repeat(64),
      p_source: "mail_attachment",
    });
    expect(error).toBeNull();

    const { data: row } = await service
      .from("files")
      .select("scope, source, bucket, owner_id")
      .eq("id", fileId as string)
      .single();
    expect(row?.scope).toBe("staff");
    expect(row?.source).toBe("mail_attachment");
    expect(row?.bucket).toBe("cloud");

    const mark = await clients.support.rpc("mail_attachment_saved_to_cloud", {
      p_message_id: messageId,
      p_index: 0,
      p_file_id: fileId as string,
    });
    expect(mark.error).toBeNull();

    const { data: message } = await service
      .from("mail_messages")
      .select("attachments")
      .eq("id", messageId)
      .single();
    const attachments = message?.attachments as { cloud_file_id?: string }[];
    expect(attachments[0]?.cloud_file_id).toBe(fileId);
  });

  it("guardar o mesmo anexo outra vez é recusado — não ficam duas cópias", async () => {
    const {
      data: { user },
    } = await clients.support.auth.getUser();
    const storagePath = `${user!.id}/${crypto.randomUUID()}/1`;
    cloudPaths.push(storagePath);

    await clients.support.storage
      .from("cloud")
      .upload(storagePath, PDF, { contentType: "application/pdf" });

    const { data: fileId } = await clients.support.rpc("cloud_register_staff_file", {
      p_name: "contrato.pdf",
      p_mime: "application/pdf",
      p_size: PDF.byteLength,
      p_storage_path: storagePath,
      p_checksum: "b".repeat(64),
      p_source: "mail_attachment",
    });

    const { error } = await clients.support.rpc("mail_attachment_saved_to_cloud", {
      p_message_id: messageId,
      p_index: 0,
      p_file_id: fileId as string,
    });
    expect(error).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // A purga
  // -------------------------------------------------------------------------

  it("as funções da purga são só da service_role — o worker é que apaga", async () => {
    for (const role of ["support", "buyer"] as const) {
      const listed = await clients[role].rpc("mail_attachments_expired", { p_limit: 10 });
      expect(listed.error).not.toBeNull();

      const purged = await clients[role].rpc("mail_attachment_purged", {
        p_message_id: messageId,
      });
      expect(purged.error).not.toBeNull();
    }
  });

  it("a janela conta-se pela reteção de app_settings, e a mensagem de hoje fica", async () => {
    const { data, error } = await service.rpc("mail_attachments_expired", { p_limit: 50 });
    expect(error).toBeNull();
    const rows = (data ?? []) as { message_id: string }[];
    expect(rows.some((row) => row.message_id === messageId)).toBe(false);
  });

  it("depois da purga, o anexo fica na lista sem caminho e com a razão", async () => {
    const { error } = await service.rpc("mail_attachment_purged", { p_message_id: messageId });
    expect(error).toBeNull();

    const { data } = await service
      .from("mail_messages")
      .select("attachments")
      .eq("id", messageId)
      .single();

    const attachments = data?.attachments as {
      filename?: string;
      path?: string;
      skipped?: string;
    }[];
    // O metadado fica para sempre: o que desaparece é o conteúdo, não o registo
    // de que houve um anexo.
    expect(attachments[0]?.filename).toBe("contrato.pdf");
    expect(attachments[0]?.path).toBeUndefined();
    expect(attachments[0]?.skipped).toBe("purged");
  });
});
