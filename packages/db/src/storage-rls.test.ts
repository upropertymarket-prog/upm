/**
 * Teste de acesso aos buckets de Storage da Fase 4 (P4-01a) —
 * `property-media` e `documents`. Mesmo padrão de `rls-matrix.test.ts`:
 * utilizadores reais autenticados por papel, upload/leitura via
 * `storage.from(bucket).upload/download`, comparado contra a matriz
 * esperada das policies de `storage.objects` (20260928100000_property_storage.sql).
 *
 * Precisa de NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e
 * SUPABASE_SERVICE_ROLE_KEY no ambiente — sem eles, salta com aviso.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listarTodosOsUtilizadores } from "./test-users";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasEnv = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

type Role = "anon" | "buyer" | "owner" | "admin" | "support";

const TEST_PASSWORD = "storage-rls-test-P@ss1";
const TEST_USERS: Record<Exclude<Role, "anon">, { email: string; role: string }> = {
  buyer: { email: "storage-rls-buyer@upropertymarket.test", role: "buyer" },
  owner: { email: "storage-rls-owner@upropertymarket.test", role: "owner" },
  admin: { email: "storage-rls-admin@upropertymarket.test", role: "admin" },
  support: { email: "storage-rls-support@upropertymarket.test", role: "support" },
};

const TEST_FILE = new Blob(["fake"], { type: "image/jpeg" });

describe.skipIf(!hasEnv)("Storage — property-media e documents (P4-01a)", () => {
  let serviceClient: SupabaseClient;
  const clients = {} as Record<Role, SupabaseClient>;
  const userIds = {} as Record<Exclude<Role, "anon">, string>;
  let ownerPropertyId: string;

  async function getOrCreateTestUser(email: string, role: string) {
    const existing = await listarTodosOsUtilizadores(serviceClient);
    const found = existing.data.users.find((u) => u.email === email);
    if (found) return found.id;

    const created = await serviceClient.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { role },
    });
    if (created.error || !created.data.user) {
      throw new Error(`Falha a criar utilizador de teste ${email}: ${created.error?.message}`);
    }
    return created.data.user.id;
  }

  beforeAll(async () => {
    serviceClient = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);
    clients.anon = createClient(SUPABASE_URL!, ANON_KEY!);

    for (const key of Object.keys(TEST_USERS) as Exclude<Role, "anon">[]) {
      const { email, role } = TEST_USERS[key];
      userIds[key] = await getOrCreateTestUser(email, role);

      const client = createClient(SUPABASE_URL!, ANON_KEY!);
      const { error } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
      if (error) throw new Error(`Falha a autenticar ${email}: ${error.message}`);
      clients[key] = client;
    }

    const { data: property, error } = await serviceClient
      .from("properties")
      .insert({
        owner_id: userIds.owner,
        ref: `STORAGE-RLS-TEST-${Date.now()}`,
        deal: "sale",
        status: "active",
        typology: "T2",
      })
      .select("id")
      .single();
    if (error || !property) throw new Error(`Falha a semear property de teste: ${error?.message}`);
    ownerPropertyId = property.id;
  });

  afterAll(async () => {
    if (!hasEnv) return;
    await serviceClient.from("properties").delete().eq("id", ownerPropertyId);
    for (const key of Object.keys(TEST_USERS) as Exclude<Role, "anon">[]) {
      await serviceClient.auth.admin.deleteUser(userIds[key]);
    }
  });

  it.each<[Role, boolean]>([
    ["anon", false],
    ["buyer", false],
    ["owner", true],
    ["admin", true],
    ["support", true],
  ])("property-media: upload como %s → permitido=%s", async (role, expected) => {
    const path = `${ownerPropertyId}/${role}-upload-test.jpg`;
    const { error } = await clients[role].storage.from("property-media").upload(path, TEST_FILE, {
      upsert: true,
    });
    expect(!error).toBe(expected);
    if (!error) await serviceClient.storage.from("property-media").remove([path]);
  });

  it("property-media: leitura pública (imóvel active) funciona via signed URL do servidor", async () => {
    const path = `${ownerPropertyId}/public-read-test.jpg`;
    await serviceClient.storage.from("property-media").upload(path, TEST_FILE, { upsert: true });

    try {
      const { data, error } = await clients.anon.storage
        .from("property-media")
        .createSignedUrl(path, 60);
      expect(error).toBeNull();
      expect(data?.signedUrl).toBeTruthy();
    } finally {
      await serviceClient.storage.from("property-media").remove([path]);
    }
  });

  it.each<[Role, boolean]>([
    ["anon", false],
    ["buyer", false],
    ["owner", true],
    ["admin", true],
    ["support", true],
  ])("documents: upload como %s → permitido=%s", async (role, expected) => {
    const path = `${ownerPropertyId}/${role}-doc-test.pdf`;
    const { error } = await clients[role].storage.from("documents").upload(path, TEST_FILE, {
      upsert: true,
    });
    expect(!error).toBe(expected);
    if (!error) await serviceClient.storage.from("documents").remove([path]);
  });

  it("documents: nunca há leitura pública, mesmo para um buyer autenticado", async () => {
    const path = `${ownerPropertyId}/never-public-test.pdf`;
    await serviceClient.storage.from("documents").upload(path, TEST_FILE, { upsert: true });

    try {
      const { error } = await clients.buyer.storage.from("documents").download(path);
      expect(error).not.toBeNull();
    } finally {
      await serviceClient.storage.from("documents").remove([path]);
    }
  });
});
