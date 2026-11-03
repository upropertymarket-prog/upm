/**
 * Fase 10 · a Cloud interna (P10-10) — 07 §24.6, 05 §1.9.
 *
 * Quatro regras, e a segunda é a que custou a descobrir:
 *
 *  1. **A Cloud interna é da equipa toda** — `is_internal()`, não `is_staff()`.
 *     Admin, Suporte e Marketing veem as mesmas linhas; um cliente não vê
 *     nenhuma.
 *  2. **Os bytes também.** A linha de `files` abrir não chega: o objeto no
 *     storage pertence ao prefixo de quem o carregou, e sem
 *     `cloud_objects_staff_select` o "transferir" devolvia 403 para toda a
 *     gente menos para quem o pôs lá. É o troço que `20261014120100` deixou
 *     escrito para esta tarefa.
 *  3. **A escrita é por função.** `files` não tem policy de `insert` desde
 *     `20260930120300`; o lado interno escreve por `cloud_register_staff_file`.
 *  4. **Apagar é de quem lá está, não de quem lá pôs.** `cloud_delete_file()`
 *     continua a ser do dono; `cloud_delete_staff_file()` é da equipa.
 *
 * Salta inteiro sem credenciais de staging (D13) — e, por decisão do cliente,
 * estes testes correm no fim do projeto, não fase a fase.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listarTodosOsUtilizadores } from "./test-users";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasEnv = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

const PASSWORD = "phase10-cloud-test-P@ss1";
const USERS = {
  marketing: { email: "phase10-cloud-marketing@upropertymarket.test", role: "marketing" },
  support: { email: "phase10-cloud-support@upropertymarket.test", role: "support" },
  owner: { email: "phase10-cloud-owner@upropertymarket.test", role: "owner" },
} as const;

type Role = keyof typeof USERS | "anon";

const STAMP = Date.now();

describe.skipIf(!hasEnv)("Fase 10 · Cloud interna: a gaveta da equipa", () => {
  let service: SupabaseClient;
  const clients = {} as Record<Role, SupabaseClient>;
  const ids = {} as Record<keyof typeof USERS, string>;

  let folderId = "";
  let fileId = "";
  let storagePath = "";

  async function getOrCreateUser(email: string, role: string) {
    const { data: users, error } = await listarTodosOsUtilizadores(service);
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
      ids[role] = id;

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

    // Um ficheiro posto pelo **Suporte**: é a montagem que importa, porque o
    // que se quer provar é que o Marketing lhe chega.
    storagePath = `${ids.support}/${crypto.randomUUID()}/1`;
    const bytes = new TextEncoder().encode(`relatorio ${STAMP}`);

    const upload = await service.storage
      .from("cloud")
      .upload(storagePath, bytes, { contentType: "text/csv", upsert: false });
    if (upload.error) throw new Error(`Falha a carregar o objeto: ${upload.error.message}`);

    const folder = await service
      .from("folders")
      .insert({ owner_id: ids.support, name: `Equipa ${STAMP}`, kind: "user", scope: "staff" })
      .select("id")
      .single();
    if (folder.error) throw new Error(`Falha a criar a pasta: ${folder.error.message}`);
    folderId = folder.data.id;

    const file = await service
      .from("files")
      .insert({
        owner_id: ids.support,
        folder_id: folderId,
        scope: "staff",
        name: `relatorio-${STAMP}.csv`,
        mime: "text/csv",
        size: bytes.byteLength,
        bucket: "cloud",
        storage_path: storagePath,
        checksum: `teste-${STAMP}`,
      })
      .select("id")
      .single();
    if (file.error) throw new Error(`Falha a criar o ficheiro: ${file.error.message}`);
    fileId = file.data.id;
  });

  afterAll(async () => {
    if (!service) return;
    await service.from("files").delete().eq("id", fileId);
    await service.from("folders").delete().eq("id", folderId);
    await service.storage.from("cloud").remove([storagePath]);
  });

  // -------------------------------------------------------------------------
  // 1 — de quem é a gaveta
  // -------------------------------------------------------------------------

  it("o Marketing vê o que o Suporte lá pôs — é o que 20261015180000 abriu", async () => {
    const { data } = await clients.marketing.from("files").select("id").eq("id", fileId);
    expect(data ?? []).toHaveLength(1);

    const { data: pastas } = await clients.marketing
      .from("folders")
      .select("id")
      .eq("id", folderId);
    expect(pastas ?? []).toHaveLength(1);
  });

  it("um cliente não vê nada da Cloud interna", async () => {
    for (const role of ["owner", "anon"] as const) {
      const { data } = await clients[role].from("files").select("id").eq("id", fileId);
      expect(data ?? [], `${role} não devia ver ficheiros da equipa`).toHaveLength(0);

      const { data: pastas } = await clients[role].from("folders").select("id").eq("id", folderId);
      expect(pastas ?? [], `${role} não devia ver pastas da equipa`).toHaveLength(0);
    }
  });

  // -------------------------------------------------------------------------
  // 2 — os bytes, que é o troço que não se vê na base de dados
  // -------------------------------------------------------------------------

  it("o Marketing transfere um objeto que o Suporte carregou", async () => {
    // Sem `cloud_objects_staff_select` isto devolvia erro: o objeto está no
    // prefixo do Suporte e `cloud_objects_owner` compara-o com `auth.uid()`.
    const { data, error } = await clients.marketing.storage
      .from("cloud")
      .createSignedUrl(storagePath, 60);

    expect(error).toBeNull();
    expect(data?.signedUrl).toBeTruthy();
  });

  it("um cliente não assina o mesmo objeto", async () => {
    const { data } = await clients.owner.storage.from("cloud").createSignedUrl(storagePath, 60);
    expect(data?.signedUrl).toBeFalsy();
  });

  // -------------------------------------------------------------------------
  // 3 — a escrita é por função
  // -------------------------------------------------------------------------

  it("ninguém insere em `files` diretamente, nem a equipa", async () => {
    // `20260930120300` tirou a policy de insert de propósito: um insert direto
    // passava ao lado da quota de 07 §19.8.
    for (const role of ["marketing", "support"] as const) {
      const { error } = await clients[role].from("files").insert({
        owner_id: ids[role],
        scope: "staff",
        name: "pirata.csv",
        mime: "text/csv",
        size: 1,
        bucket: "cloud",
        storage_path: `${ids[role]}/pirata/1`,
        checksum: "x",
      });
      expect(error, `${role} não devia poder inserir`).not.toBeNull();
    }
  });

  it("a porta de escrita aceita o Marketing e recusa um cliente", async () => {
    const caminho = `${ids.marketing}/${crypto.randomUUID()}/1`;
    const bytes = new TextEncoder().encode("x");
    await service.storage.from("cloud").upload(caminho, bytes, { contentType: "text/csv" });

    const { data, error } = await clients.marketing.rpc("cloud_register_staff_file", {
      p_name: `do-marketing-${STAMP}.csv`,
      p_mime: "text/csv",
      p_size: 1,
      p_storage_path: caminho,
      p_checksum: `m-${STAMP}`,
      p_source: "campaign_report",
      p_folder_id: folderId,
    });
    expect(error).toBeNull();

    const { error: recusa } = await clients.owner.rpc("cloud_register_staff_file", {
      p_name: "pirata.csv",
      p_mime: "text/csv",
      p_size: 1,
      p_storage_path: `${ids.owner}/pirata/1`,
      p_checksum: "x",
    });
    expect(recusa).not.toBeNull();

    await service.from("files").delete().eq("id", String(data));
    await service.storage.from("cloud").remove([caminho]);
  });

  it("a pasta tem de ser da Cloud interna", async () => {
    const pessoal = await service
      .from("folders")
      .insert({ owner_id: ids.owner, name: `Pessoal ${STAMP}`, kind: "user", scope: "personal" })
      .select("id")
      .single();

    const { error } = await clients.marketing.rpc("cloud_register_staff_file", {
      p_name: "fora.csv",
      p_mime: "text/csv",
      p_size: 1,
      p_storage_path: `${ids.marketing}/fora/1`,
      p_checksum: "x",
      p_folder_id: pessoal.data!.id,
    });
    // Sem esta verificação, um ficheiro de equipa aterrava dentro da Cloud
    // privada de alguém que nunca o pôs lá.
    expect(error).not.toBeNull();

    await service.from("folders").delete().eq("id", pessoal.data!.id);
  });

  // -------------------------------------------------------------------------
  // 4 — apagar é de quem lá está
  // -------------------------------------------------------------------------

  it("o Marketing apaga e repõe um ficheiro que o Suporte carregou", async () => {
    const apagar = await clients.marketing.rpc("cloud_delete_staff_file", { p_file_id: fileId });
    expect(apagar.error).toBeNull();

    const { data: apagado } = await service
      .from("files")
      .select("deleted_at, purge_after")
      .eq("id", fileId)
      .single();
    expect(apagado?.deleted_at).not.toBeNull();
    expect(apagado?.purge_after).not.toBeNull();

    const repor = await clients.marketing.rpc("cloud_restore_staff_file", { p_file_id: fileId });
    expect(repor.error).toBeNull();

    const { data: reposto } = await service
      .from("files")
      .select("deleted_at, purge_after")
      .eq("id", fileId)
      .single();
    // As duas datas: só limpar `deleted_at` deixava-o a ser varrido na mesma.
    expect(reposto?.deleted_at).toBeNull();
    expect(reposto?.purge_after).toBeNull();
  });

  it("um cliente não apaga nada da Cloud interna", async () => {
    const { error } = await clients.owner.rpc("cloud_delete_staff_file", { p_file_id: fileId });
    expect(error).not.toBeNull();
  });

  it("a função da equipa não toca em ficheiros pessoais", async () => {
    const pessoal = await service
      .from("files")
      .insert({
        owner_id: ids.owner,
        scope: "personal",
        name: `pessoal-${STAMP}.pdf`,
        mime: "application/pdf",
        size: 1,
        bucket: "cloud",
        storage_path: `${ids.owner}/${crypto.randomUUID()}/1`,
        checksum: `p-${STAMP}`,
      })
      .select("id")
      .single();

    const { error } = await clients.marketing.rpc("cloud_delete_staff_file", {
      p_file_id: pessoal.data!.id,
    });
    expect(error).not.toBeNull();

    await service.from("files").delete().eq("id", pessoal.data!.id);
  });
});
