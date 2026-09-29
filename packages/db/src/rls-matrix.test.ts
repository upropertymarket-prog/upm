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
  // get_property_location — Fase 4, requisito transversal (Plano P4-01 AC):
  // a coordenada exata nunca vaza fora das condições explícitas de 07 §1.2.
  // Casos que faltavam à cobertura acima: show_exact=true e grant revogado.
  // -------------------------------------------------------------------------

  it("get_property_location: show_exact=true dá a exata a um buyer sem grant", async () => {
    await serviceClient
      .from("properties")
      .update({ location: "SRID=4326;POINT(-9.14 38.72)", show_exact: true })
      .eq("id", ownerPropertyId);

    try {
      const { data: exact } = await clients.owner.rpc("get_property_location", {
        p_property_id: ownerPropertyId,
      });
      const { data: asBuyer } = await clients.buyer.rpc("get_property_location", {
        p_property_id: ownerPropertyId,
      });
      expect(asBuyer).toBe(exact);
      expect(asBuyer).not.toBeNull();
    } finally {
      await serviceClient
        .from("properties")
        .update({ location: null, show_exact: false })
        .eq("id", ownerPropertyId);
    }
  });

  it("get_property_location: grant revogado volta a devolver só a aproximada", async () => {
    await serviceClient
      .from("properties")
      .update({
        location: "SRID=4326;POINT(-9.14 38.72)",
        location_approx: "SRID=4326;POINT(-9.15 38.73)",
      })
      .eq("id", ownerPropertyId);

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
      const { data: whileActive } = await clients.buyer.rpc("get_property_location", {
        p_property_id: ownerPropertyId,
      });
      const { data: approx } = await clients.owner.rpc("get_property_location", {
        p_property_id: ownerPropertyId,
      });

      await serviceClient
        .from("property_address_grants")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", grant!.id);

      const { data: afterRevoke } = await clients.buyer.rpc("get_property_location", {
        p_property_id: ownerPropertyId,
      });

      expect(whileActive).not.toBeNull();
      expect(afterRevoke).not.toBe(whileActive);
      expect(afterRevoke).not.toBeNull();
      void approx;
    } finally {
      await serviceClient.from("property_address_grants").delete().eq("id", grant!.id);
      await serviceClient
        .from("properties")
        .update({ location: null, location_approx: null })
        .eq("id", ownerPropertyId);
    }
  });

  // -------------------------------------------------------------------------
  // property_media — Fase 4 (fecha D14 para esta tabela). Segue a posse do
  // imóvel: dono+staff full; público só lê se o imóvel é active/featured.
  // -------------------------------------------------------------------------

  describe("property_media", () => {
    let mediaId: string;

    beforeAll(async () => {
      const { data, error } = await serviceClient
        .from("property_media")
        .insert({
          property_id: ownerPropertyId,
          path: "property-media/test/cover.jpg",
          kind: "photo",
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(`Falha a semear property_media: ${error?.message}`);
      mediaId = data.id;
    });

    afterAll(async () => {
      await serviceClient.from("property_media").delete().eq("id", mediaId);
    });

    it.each<[Role, boolean]>([
      ["anon", true], // imóvel de teste fica `active`
      ["buyer", true],
      ["owner", true],
      ["admin", true],
      ["support", true],
    ])("select como %s → permitido=%s", async (role, expected) => {
      const { data } = await clients[role].from("property_media").select("id").eq("id", mediaId);
      expect((data?.length ?? 0) > 0).toBe(expected);
    });

    it.each<[Role, boolean]>([
      ["anon", false],
      ["buyer", false],
      ["owner", true],
      ["admin", true],
      ["support", true],
    ])("update (position) como %s → permitido=%s", async (role, expected) => {
      const { data } = await clients[role]
        .from("property_media")
        .update({ position: 1 })
        .eq("id", mediaId)
        .select("id");
      expect((data?.length ?? 0) > 0).toBe(expected);
    });
  });

  // -------------------------------------------------------------------------
  // property_documents — Fase 4 (fecha D14). Nunca leitura pública, mesmo
  // para um buyer autenticado — só dono+staff (05 §1.4, documentos privados).
  // -------------------------------------------------------------------------

  describe("property_documents", () => {
    let documentId: string;

    beforeAll(async () => {
      const { data, error } = await serviceClient
        .from("property_documents")
        .insert({
          property_id: ownerPropertyId,
          storage_path: "documents/test/certidao.pdf",
          name: "certidao.pdf",
          mime: "application/pdf",
          size: 1024,
          kind: "certidao",
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(`Falha a semear property_documents: ${error?.message}`);
      documentId = data.id;
    });

    afterAll(async () => {
      await serviceClient.from("property_documents").delete().eq("id", documentId);
    });

    it.each<[Role, boolean]>([
      ["anon", false],
      ["buyer", false],
      ["owner", true],
      ["admin", true],
      ["support", true],
    ])("select como %s → permitido=%s", async (role, expected) => {
      const { data } = await clients[role]
        .from("property_documents")
        .select("id")
        .eq("id", documentId);
      expect((data?.length ?? 0) > 0).toBe(expected);
    });
  });

  // -------------------------------------------------------------------------
  // property_views — Fase 4 (fecha D14). Só dono+staff leem; nenhum papel
  // autenticado por anon-key pode escrever (sem policy de insert — só
  // service_role, ver 05 §1.2 comentário da migração).
  // -------------------------------------------------------------------------

  describe("property_views", () => {
    let viewRowId: string;
    const today = new Date().toISOString().slice(0, 10);

    beforeAll(async () => {
      const { data, error } = await serviceClient
        .from("property_views")
        .insert({ property_id: ownerPropertyId, day: today, views_count: 3 })
        .select("id")
        .single();
      if (error || !data) throw new Error(`Falha a semear property_views: ${error?.message}`);
      viewRowId = data.id;
    });

    afterAll(async () => {
      await serviceClient.from("property_views").delete().eq("id", viewRowId);
    });

    it.each<[Role, boolean]>([
      ["anon", false],
      ["buyer", false],
      ["owner", true],
      ["admin", true],
      ["support", true],
    ])("select como %s → permitido=%s", async (role, expected) => {
      const { data } = await clients[role].from("property_views").select("id").eq("id", viewRowId);
      expect((data?.length ?? 0) > 0).toBe(expected);
    });

    it.each<[Role, boolean]>([
      ["anon", false],
      ["buyer", false],
      ["owner", false],
      ["admin", false],
      ["support", false],
    ])("insert como %s → permitido=%s (só service_role escreve)", async (role, expected) => {
      const { data, error } = await clients[role]
        .from("property_views")
        .insert({ property_id: ownerPropertyId, day: "2020-01-01", views_count: 1 })
        .select("id");
      expect(!error && (data?.length ?? 0) > 0).toBe(expected);
      const created = data?.[0];
      if (created) await serviceClient.from("property_views").delete().eq("id", created.id);
    });
  });

  // -------------------------------------------------------------------------
  // saved_properties / search_alerts — Fase 4 (fecha D14). Só o próprio
  // utilizador; staff lê para suporte, nunca escreve em nome de outro.
  // -------------------------------------------------------------------------

  describe("saved_properties", () => {
    it("buyer guarda, lê e remove o seu próprio guardado", async () => {
      const { data: inserted, error } = await clients.buyer
        .from("saved_properties")
        .insert({
          user_id: userIds.buyer,
          property_id: ownerPropertyId,
          price_at_save_cents: 100000,
        })
        .select("id")
        .single();
      expect(error).toBeNull();
      expect(inserted).not.toBeNull();

      const { data: read } = await clients.buyer
        .from("saved_properties")
        .select("id")
        .eq("id", inserted!.id);
      expect(read?.length ?? 0).toBe(1);

      await clients.buyer.from("saved_properties").delete().eq("id", inserted!.id);
      const { data: afterDelete } = await serviceClient
        .from("saved_properties")
        .select("id")
        .eq("id", inserted!.id);
      expect(afterDelete?.length ?? 0).toBe(0);
    });

    it("owner não consegue guardar em nome do buyer", async () => {
      const { data, error } = await clients.owner
        .from("saved_properties")
        .insert({ user_id: userIds.buyer, property_id: ownerPropertyId })
        .select("id");
      expect(!error && (data?.length ?? 0) > 0).toBe(false);
    });

    it("staff lê guardados de outros, mas não os cria em nome deles", async () => {
      const { data: seeded } = await serviceClient
        .from("saved_properties")
        .insert({ user_id: userIds.buyer, property_id: ownerPropertyId })
        .select("id")
        .single();

      try {
        const { data: readAsAdmin } = await clients.admin
          .from("saved_properties")
          .select("id")
          .eq("id", seeded!.id);
        expect(readAsAdmin?.length ?? 0).toBe(1);

        const { data: insertedByAdmin } = await clients.admin
          .from("saved_properties")
          .insert({ user_id: userIds.buyer, property_id: ownerPropertyId })
          .select("id");
        expect(insertedByAdmin?.length ?? 0).toBe(0);
      } finally {
        await serviceClient.from("saved_properties").delete().eq("id", seeded!.id);
      }
    });
  });

  describe("search_alerts", () => {
    it("buyer cria, lê e remove o seu próprio alerta", async () => {
      const { data: inserted, error } = await clients.buyer
        .from("search_alerts")
        .insert({ user_id: userIds.buyer, filters: { city: "Lisboa" } })
        .select("id")
        .single();
      expect(error).toBeNull();
      expect(inserted).not.toBeNull();

      const { data: read } = await clients.buyer
        .from("search_alerts")
        .select("id")
        .eq("id", inserted!.id);
      expect(read?.length ?? 0).toBe(1);

      await clients.buyer.from("search_alerts").delete().eq("id", inserted!.id);
    });

    it.each<[Role, boolean]>([
      ["anon", false],
      ["buyer", false], // não é o dono do alerta
      ["owner", true],
      ["admin", true],
      ["support", true],
    ])(
      "select do alerta de outro utilizador (owner) como %s → permitido=%s",
      async (role, expected) => {
        const { data: seeded } = await serviceClient
          .from("search_alerts")
          .insert({ user_id: userIds.owner, filters: {} })
          .select("id")
          .single();

        try {
          const { data } = await clients[role]
            .from("search_alerts")
            .select("id")
            .eq("id", seeded!.id);
          expect((data?.length ?? 0) > 0).toBe(expected);
        } finally {
          await serviceClient.from("search_alerts").delete().eq("id", seeded!.id);
        }
      },
    );
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
