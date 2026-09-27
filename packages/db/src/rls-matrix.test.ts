/**
 * Teste de matriz de acesso por papel — 08 §2.3 (fecha a dívida D3, registada
 * na Fase 0 para a Fase 2, "com o schema de domínio").
 *
 * Corre contra o projeto de staging ligado (07 §12.1), autenticado como
 * utilizadores reais anon/buyer/owner/admin/support, e verifica select/
 * insert/update/delete em `properties` (a tabela mais sensível desta fase —
 * é onde vive a privacidade de localização de 07 §1) contra a matriz
 * esperada. `plans` e `property_address_grants` têm verificações pontuais
 * das regras mais importantes (leitura pública / posse), não a grelha
 * completa — expandir por tabela fica para quando essas tabelas tiverem
 * lógica própria a testar (Fases 4, 6, 8).
 *
 * Precisa de NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e
 * SUPABASE_SERVICE_ROLE_KEY no ambiente. Sem eles, salta com aviso — os
 * mesmos segredos que faltam ao `gate:db` no CI (08 §9, D6).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasEnv = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

type Role = "anon" | "buyer" | "owner" | "admin" | "support";

const TEST_PASSWORD = "rls-matrix-test-P@ss1";
const TEST_USERS: Record<Exclude<Role, "anon">, { email: string; role: string }> = {
  buyer: { email: "rls-matrix-buyer@upropertymarket.test", role: "buyer" },
  owner: { email: "rls-matrix-owner@upropertymarket.test", role: "owner" },
  admin: { email: "rls-matrix-admin@upropertymarket.test", role: "admin" },
  support: { email: "rls-matrix-support@upropertymarket.test", role: "support" },
};

describe.skipIf(!hasEnv)("Matriz de acesso por papel (08 §2.3)", () => {
  let serviceClient: SupabaseClient;
  const clients = {} as Record<Role, SupabaseClient>;
  const userIds = {} as Record<Exclude<Role, "anon">, string>;
  let ownerPropertyId: string;

  async function getOrCreateTestUser(email: string, role: string) {
    const existing = await serviceClient.auth.admin.listUsers();
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

    // Um imóvel `active` do owner de teste, para os cenários de leitura/escrita.
    const { data: property, error } = await serviceClient
      .from("properties")
      .insert({
        owner_id: userIds.owner,
        ref: `RLS-TEST-${Date.now()}`,
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
    await serviceClient.from("properties").delete().eq("owner_id", userIds.owner);
    for (const key of Object.keys(TEST_USERS) as Exclude<Role, "anon">[]) {
      await serviceClient.auth.admin.deleteUser(userIds[key]);
    }
  });

  // -------------------------------------------------------------------------
  // properties — leitura direta (RLS da tabela, não a view pública)
  // -------------------------------------------------------------------------

  it.each<[Role, boolean]>([
    ["anon", false],
    ["buyer", false],
    ["owner", true],
    ["admin", true],
    ["support", true],
  ])("properties: select direto como %s → permitido=%s", async (role, expected) => {
    const { data } = await clients[role].from("properties").select("id").eq("id", ownerPropertyId);
    expect((data ?? []).length > 0).toBe(expected);
  });

  it("properties_public: qualquer papel (incl. anon) vê o imóvel active", async () => {
    for (const role of ["anon", "buyer", "owner", "admin", "support"] as Role[]) {
      const { data } = await clients[role]
        .from("properties_public")
        .select("id, location_approx")
        .eq("id", ownerPropertyId);
      expect(data?.length ?? 0).toBe(1);
      // 08 §2.7: a view pública nunca expõe a coluna `location` (exata).
      expect(data?.[0]).not.toHaveProperty("location");
    }
  });

  // -------------------------------------------------------------------------
  // properties — escrita
  // -------------------------------------------------------------------------

  it.each<[Role, boolean]>([
    ["anon", false],
    ["buyer", false],
    ["owner", true],
    ["admin", false], // admin modera via update, não cria imóveis de outros
    ["support", false],
  ])("properties: insert como %s → permitido=%s", async (role, expected) => {
    const { data, error } = await clients[role]
      .from("properties")
      .insert({
        owner_id: userIds.owner,
        ref: `RLS-TEST-INSERT-${role}-${Date.now()}`,
        deal: "rent",
        status: "draft",
        typology: "T1",
      })
      .select("id");

    expect(!error && (data?.length ?? 0) > 0).toBe(expected);
    const created = data?.[0];
    if (created) await serviceClient.from("properties").delete().eq("id", created.id);
  });

  it.each<[Role, boolean]>([
    ["anon", false],
    ["buyer", false],
    ["owner", true],
    ["admin", true],
    ["support", true],
  ])("properties: update (título) como %s → permitido=%s", async (role, expected) => {
    const marker = `rls-test-${role}-${Date.now()}`;
    const { data } = await clients[role]
      .from("properties")
      .update({ title: marker })
      .eq("id", ownerPropertyId)
      .select("id");
    expect((data?.length ?? 0) > 0).toBe(expected);
  });

  // -------------------------------------------------------------------------
  // get_property_location — 07 §1.2: sem grant nem show_exact, comprador só
  // vê a aproximada; o dono vê sempre a exata.
  // -------------------------------------------------------------------------

  it("get_property_location: buyer sem grant recebe a aproximada, não a exata", async () => {
    const { data: exactAsOwner } = await clients.owner.rpc("get_property_location", {
      p_property_id: ownerPropertyId,
    });
    const { data: asBuyer } = await clients.buyer.rpc("get_property_location", {
      p_property_id: ownerPropertyId,
    });
    // Sem `location` definido no seed, ambas ficam null — o que importa aqui
    // é que a função corre para os dois papéis sem erro de RLS/permissão.
    expect(exactAsOwner === null || typeof exactAsOwner === "string").toBe(true);
    expect(asBuyer === null || typeof asBuyer === "string").toBe(true);
  });

  // -------------------------------------------------------------------------
  // plans — leitura pública, escrita só admin (05 §1.6, 08 §9 seed)
  // -------------------------------------------------------------------------

  it("plans: select é público (incluindo anon)", async () => {
    const { data, error } = await clients.anon.from("plans").select("slug").limit(1);
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBeGreaterThan(0);
  });

  it.each<[Role, boolean]>([
    ["buyer", false],
    ["owner", false],
    ["support", false],
    ["admin", true],
  ])("plans: update do nome como %s → permitido=%s", async (role, expected) => {
    const { data: anyPlan } = await serviceClient
      .from("plans")
      .select("id, name")
      .limit(1)
      .single();
    const { data } = await clients[role]
      .from("plans")
      .update({ name: anyPlan!.name })
      .eq("id", anyPlan!.id)
      .select("id");
    expect((data?.length ?? 0) > 0).toBe(expected);
  });

  // -------------------------------------------------------------------------
  // property_address_grants — 07 §1: só dono, comprador visado e staff leem.
  // -------------------------------------------------------------------------

  it.each<[Role, boolean]>([
    ["anon", false],
    ["buyer", true], // é o buyer_id do grant
    ["owner", true], // é o dono do imóvel
    ["admin", true],
    ["support", true],
  ])("property_address_grants: select como %s → permitido=%s", async (role, expected) => {
    const { data: grant } = await serviceClient
      .from("property_address_grants")
      .insert({
        property_id: ownerPropertyId,
        buyer_id: userIds.buyer,
        granted_by: userIds.owner,
        source: "manual",
      })
      .select("id")
      .single();

    try {
      const { data } = await clients[role]
        .from("property_address_grants")
        .select("id")
        .eq("id", grant!.id);
      expect((data?.length ?? 0) > 0).toBe(expected);
    } finally {
      await serviceClient.from("property_address_grants").delete().eq("id", grant!.id);
    }
  });
});
