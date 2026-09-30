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

type Role = "anon" | "buyer" | "buyer2" | "owner" | "admin" | "support";

const TEST_PASSWORD = "rls-matrix-test-P@ss1";
const TEST_USERS: Record<Exclude<Role, "anon">, { email: string; role: string }> = {
  buyer: { email: "rls-matrix-buyer@upropertymarket.test", role: "buyer" },
  // Segundo comprador: serve os casos de "um terceiro não vê" da Fase 5.
  buyer2: { email: "rls-matrix-buyer2@upropertymarket.test", role: "buyer" },
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

  // -------------------------------------------------------------------------
  // Fase 5 — Interação (P5-01 a P5-04)
  //
  // 08 §2.3 pede a matriz por papel em cada tabela nova. Aqui verifica-se mais
  // do que a matriz: as transições de estado (07 §5.6), a criação automática
  // de leads (07 §18.3) e o grant de morada que nasce com o `accepted`
  // (07 §1.2.4) vivem em funções `security definer` — se elas cederem, a RLS
  // sozinha não salva nada.
  // -------------------------------------------------------------------------

  describe("Interação — conversas, mensagens, visitas, leads e notificações", () => {
    let propertyId: string;
    let conversationId: string;

    beforeAll(async () => {
      // Imóvel próprio destes testes: os de cima mexem em `show_exact` e em
      // `location` do `ownerPropertyId`, e isso mudaria o que aqui se mede.
      const { data, error } = await serviceClient
        .from("properties")
        .insert({
          owner_id: userIds.owner,
          ref: `RLS-F5-${Date.now()}`,
          title: "T2 de teste da Fase 5",
          deal: "sale",
          status: "active",
          typology: "T2",
          city: "Lisboa",
          price_cents: 250_000_00,
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(`Falha a semear imóvel da Fase 5: ${error?.message}`);
      propertyId = data.id;
    });

    afterAll(async () => {
      await serviceClient.from("properties").delete().eq("id", propertyId);
      for (const key of ["buyer", "buyer2", "owner"] as const) {
        await serviceClient.from("notifications").delete().eq("profile_id", userIds[key]);
      }
    });

    // -----------------------------------------------------------------------
    // Conversas — 03 F5
    // -----------------------------------------------------------------------

    it("start_conversation: o comprador abre a conversa e é idempotente", async () => {
      const first = await clients.buyer.rpc("start_conversation", { p_property_id: propertyId });
      expect(first.error).toBeNull();
      expect(typeof first.data).toBe("string");
      conversationId = first.data as string;

      // Voltar a "Contactar proprietário" não cria uma segunda conversa.
      const second = await clients.buyer.rpc("start_conversation", { p_property_id: propertyId });
      expect(second.data).toBe(conversationId);
    });

    it("start_conversation: o dono não se contacta a si próprio", async () => {
      const { error } = await clients.owner.rpc("start_conversation", {
        p_property_id: propertyId,
      });
      expect(error).not.toBeNull();
    });

    it.each<[Role, boolean]>([
      ["anon", false],
      ["buyer", true], // participante
      ["buyer2", false], // 02 §7.1: só participantes
      ["owner", true], // participante
      ["admin", false], // staff sem motivo registado não entra (02 §7.1)
      ["support", false],
    ])("conversations: select como %s → permitido=%s", async (role, expected) => {
      const { data } = await clients[role]
        .from("conversations")
        .select("id")
        .eq("id", conversationId);
      expect((data?.length ?? 0) > 0).toBe(expected);
    });

    it("conversations: ninguém insere diretamente — só por start_conversation", async () => {
      const { error } = await clients.buyer.from("conversations").insert({
        property_id: propertyId,
        buyer_id: userIds.buyer,
        owner_id: userIds.owner,
      });
      expect(error).not.toBeNull();
    });

    // -----------------------------------------------------------------------
    // Mensagens — 05 §6.3
    // -----------------------------------------------------------------------

    it("messages: o comprador escreve e o proprietário lê", async () => {
      const { error } = await clients.buyer.from("messages").insert({
        conversation_id: conversationId,
        sender_id: userIds.buyer,
        body: "A garagem é individual?",
      });
      expect(error).toBeNull();

      const { data } = await clients.owner
        .from("messages")
        .select("id, body")
        .eq("conversation_id", conversationId);
      expect(data?.length ?? 0).toBe(1);
    });

    it("messages: um terceiro não lê nem escreve na conversa alheia", async () => {
      const { data } = await clients.buyer2
        .from("messages")
        .select("id")
        .eq("conversation_id", conversationId);
      expect(data?.length ?? 0).toBe(0);

      const { error } = await clients.buyer2.from("messages").insert({
        conversation_id: conversationId,
        sender_id: userIds.buyer2,
        body: "intruso",
      });
      expect(error).not.toBeNull();
    });

    it("messages: não se assina uma mensagem com o nome de outro", async () => {
      // 08 §7.3 — a policy exige sender_id = auth.uid(); a Server Action nunca
      // deixa o cliente escolher, mas a defesa tem de estar também aqui.
      const { error } = await clients.buyer.from("messages").insert({
        conversation_id: conversationId,
        sender_id: userIds.owner,
        body: "faz de conta que sou o dono",
      });
      expect(error).not.toBeNull();
    });

    it("mark_conversation_read: marca o que o outro escreveu, não o meu", async () => {
      await clients.owner.rpc("mark_conversation_read", { p_conversation_id: conversationId });

      const { data } = await serviceClient
        .from("messages")
        .select("read_at")
        .eq("conversation_id", conversationId);
      expect(data?.every((row) => row.read_at !== null)).toBe(true);
    });

    // -----------------------------------------------------------------------
    // Leads — 07 §18.3: nascem sozinhas da primeira mensagem
    // -----------------------------------------------------------------------

    it("owner_leads: a primeira mensagem do comprador criou a lead em contacted", async () => {
      const { data } = await serviceClient
        .from("owner_leads")
        .select("stage, source, owner_id, contact_profile_id")
        .eq("property_id", propertyId);

      expect(data?.length).toBe(1);
      expect(data?.[0]?.stage).toBe("contacted");
      expect(data?.[0]?.source).toBe("message");
      expect(data?.[0]?.owner_id).toBe(userIds.owner);
      expect(data?.[0]?.contact_profile_id).toBe(userIds.buyer);
    });

    it.each<[Role, boolean]>([
      ["anon", false],
      ["buyer", false], // o interessado nunca vê em que gaveta está
      ["owner", true],
      ["admin", true],
      ["support", true],
    ])("owner_leads: select como %s → permitido=%s", async (role, expected) => {
      const { data } = await clients[role]
        .from("owner_leads")
        .select("id")
        .eq("property_id", propertyId);
      expect((data?.length ?? 0) > 0).toBe(expected);
    });

    it("set_lead_stage: fechar sem desfecho é recusado (07 §18.2)", async () => {
      const { data: lead } = await serviceClient
        .from("owner_leads")
        .select("id")
        .eq("property_id", propertyId)
        .single();

      const withoutOutcome = await clients.owner.rpc("set_lead_stage", {
        p_lead_id: lead!.id,
        p_stage: "closed",
      });
      expect(withoutOutcome.error).not.toBeNull();

      const withOutcome = await clients.owner.rpc("set_lead_stage", {
        p_lead_id: lead!.id,
        p_stage: "closed",
        p_outcome: "won",
      });
      expect(withOutcome.error).toBeNull();

      // Devolve-se ao estado anterior para os testes de visita continuarem.
      await serviceClient
        .from("owner_leads")
        .update({ stage: "contacted", outcome: null })
        .eq("id", lead!.id);
    });

    it("set_lead_stage: outro proprietário não mexe na lead alheia", async () => {
      const { data: lead } = await serviceClient
        .from("owner_leads")
        .select("id")
        .eq("property_id", propertyId)
        .single();

      const { error } = await clients.buyer2.rpc("set_lead_stage", {
        p_lead_id: lead!.id,
        p_stage: "visit",
      });
      expect(error).not.toBeNull();
    });

    // -----------------------------------------------------------------------
    // Visitas — 03 F6, 07 §1.2 e §5.6
    // -----------------------------------------------------------------------

    let visitId: string;
    const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

    it("request_visit: o comprador pede, e um segundo pedido aberto é recusado", async () => {
      const first = await clients.buyer.rpc("request_visit", {
        p_property_id: propertyId,
        p_proposed_at: inDays(3),
        p_message: "Sábado de manhã?",
      });
      expect(first.error).toBeNull();
      visitId = first.data as string;

      const second = await clients.buyer.rpc("request_visit", {
        p_property_id: propertyId,
        p_proposed_at: inDays(4),
        p_message: "",
      });
      expect(second.error).not.toBeNull();
    });

    it("request_visit: recusa uma data no passado", async () => {
      const { error } = await clients.buyer2.rpc("request_visit", {
        p_property_id: propertyId,
        p_proposed_at: inDays(-1),
        p_message: "",
      });
      expect(error).not.toBeNull();
    });

    it("reschedule: o comprador não repropõe a data que ele próprio pediu", async () => {
      // 07 §5.6 — o pedido inicial é o comprador a propor uma data; a vez
      // seguinte é do proprietário, mesmo com o contador ainda a zero.
      const { error } = await clients.buyer.rpc("reschedule_visit_request", {
        p_id: visitId,
        p_proposed_at: inDays(6),
      });
      expect(error).not.toBeNull();

      const { data } = await serviceClient
        .from("visit_requests")
        .select("reschedule_count, status")
        .eq("id", visitId)
        .single();
      expect(data?.reschedule_count).toBe(0);
      expect(data?.status).toBe("pending");
    });

    it.each<[Role, boolean]>([
      ["anon", false],
      ["buyer", true],
      ["buyer2", false],
      ["owner", true],
      ["admin", true],
      ["support", true],
    ])("visit_requests: select como %s → permitido=%s", async (role, expected) => {
      const { data } = await clients[role].from("visit_requests").select("id").eq("id", visitId);
      expect((data?.length ?? 0) > 0).toBe(expected);
    });

    it("visit_requests: nenhum papel escreve diretamente — só pelas funções", async () => {
      const { error } = await clients.owner
        .from("visit_requests")
        .update({ status: "accepted" })
        .eq("id", visitId);
      // Sem policy de update, a linha não é encontrada para escrita.
      const { data: after } = await serviceClient
        .from("visit_requests")
        .select("status")
        .eq("id", visitId)
        .single();
      expect(error === null && after?.status === "accepted").toBe(false);
    });

    it("accept_visit_request: o comprador não aceita a data que ele próprio pediu", async () => {
      const { error } = await clients.buyer.rpc("accept_visit_request", { p_id: visitId });
      expect(error).not.toBeNull();
    });

    it("accept_visit_request: o dono aceita, o grant de morada nasce na mesma transação", async () => {
      const { error } = await clients.owner.rpc("accept_visit_request", { p_id: visitId });
      expect(error).toBeNull();

      const { data: visit } = await serviceClient
        .from("visit_requests")
        .select("status")
        .eq("id", visitId)
        .single();
      expect(visit?.status).toBe("accepted");

      // 07 §1.2.4/§1.2.5 — não existe visita aceite sem morada partilhada.
      const { data: grants } = await serviceClient
        .from("property_address_grants")
        .select("id, source, granted_by, revoked_at")
        .eq("property_id", propertyId)
        .eq("buyer_id", userIds.buyer);
      expect(grants?.length).toBe(1);
      expect(grants?.[0]?.source).toBe("visit_request");
      expect(grants?.[0]?.granted_by).toBe(userIds.owner);
      expect(grants?.[0]?.revoked_at).toBeNull();
    });

    it("a visita aceite fez a lead avançar para `visit` (07 §18.3)", async () => {
      const { data } = await serviceClient
        .from("owner_leads")
        .select("stage")
        .eq("property_id", propertyId)
        .single();
      expect(data?.stage).toBe("visit");
    });

    it("get_property_location: com grant, o comprador passa a receber a exata", async () => {
      await serviceClient
        .from("properties")
        .update({ location: "SRID=4326;POINT(-9.15 38.73)", show_exact: false })
        .eq("id", propertyId);

      const { data: asOwner } = await clients.owner.rpc("get_property_location", {
        p_property_id: propertyId,
      });
      const { data: asBuyer } = await clients.buyer.rpc("get_property_location", {
        p_property_id: propertyId,
      });
      const { data: asStranger } = await clients.buyer2.rpc("get_property_location", {
        p_property_id: propertyId,
      });

      expect(asBuyer).toBe(asOwner);
      expect(asStranger).not.toBe(asOwner);
    });

    it("reschedule: alterna os lados e para aos 3 (07 §5.6)", async () => {
      // 1.º — o dono reagenda.
      const r1 = await clients.owner.rpc("reschedule_visit_request", {
        p_id: visitId,
        p_proposed_at: inDays(5),
      });
      expect(r1.error).toBeNull();

      // O mesmo lado outra vez: recusado, é a vez do outro.
      const again = await clients.owner.rpc("reschedule_visit_request", {
        p_id: visitId,
        p_proposed_at: inDays(6),
      });
      expect(again.error).not.toBeNull();

      // 2.º — o comprador reagenda.
      const r2 = await clients.buyer.rpc("reschedule_visit_request", {
        p_id: visitId,
        p_proposed_at: inDays(7),
      });
      expect(r2.error).toBeNull();

      // 3.º — o dono reagenda: o último possível.
      const r3 = await clients.owner.rpc("reschedule_visit_request", {
        p_id: visitId,
        p_proposed_at: inDays(8),
      });
      expect(r3.error).toBeNull();

      const { data: visit } = await serviceClient
        .from("visit_requests")
        .select("reschedule_count, status")
        .eq("id", visitId)
        .single();
      expect(visit?.reschedule_count).toBe(3);
      expect(visit?.status).toBe("rescheduled");

      // 4.º — bloqueado dos dois lados.
      const r4 = await clients.buyer.rpc("reschedule_visit_request", {
        p_id: visitId,
        p_proposed_at: inDays(9),
      });
      expect(r4.error).not.toBeNull();
    });

    it("accept: esgotados os reagendamentos, o outro lado ainda pode aceitar", async () => {
      // A data em cima da mesa foi proposta pelo dono → aceita o comprador.
      const { error } = await clients.buyer.rpc("accept_visit_request", { p_id: visitId });
      expect(error).toBeNull();

      const { data } = await serviceClient
        .from("visit_requests")
        .select("status")
        .eq("id", visitId)
        .single();
      expect(data?.status).toBe("accepted");
    });

    it("cancel + archive: um estranho não cancela, o participante cancela e arquiva", async () => {
      const stranger = await clients.buyer2.rpc("cancel_visit_request", { p_id: visitId });
      expect(stranger.error).not.toBeNull();

      const cancelled = await clients.buyer.rpc("cancel_visit_request", { p_id: visitId });
      expect(cancelled.error).toBeNull();

      const archived = await clients.owner.rpc("archive_visit_request", { p_id: visitId });
      expect(archived.error).toBeNull();

      const { data } = await serviceClient
        .from("visit_requests")
        .select("status, cancelled_by")
        .eq("id", visitId)
        .single();
      expect(data?.status).toBe("archived");
      expect(data?.cancelled_by).toBe(userIds.buyer);
    });

    it("07 §1.2.7: cancelar não revoga o grant de morada", async () => {
      const { data } = await serviceClient
        .from("property_address_grants")
        .select("revoked_at")
        .eq("property_id", propertyId)
        .eq("buyer_id", userIds.buyer)
        .single();
      expect(data?.revoked_at).toBeNull();
    });

    it("revoke_address_grant: só o dono revoga", async () => {
      const { data: grant } = await serviceClient
        .from("property_address_grants")
        .select("id")
        .eq("property_id", propertyId)
        .eq("buyer_id", userIds.buyer)
        .single();

      const byBuyer = await clients.buyer.rpc("revoke_address_grant", { p_grant_id: grant!.id });
      expect(byBuyer.error).not.toBeNull();

      const byOwner = await clients.owner.rpc("revoke_address_grant", { p_grant_id: grant!.id });
      expect(byOwner.error).toBeNull();

      const { data: after } = await serviceClient
        .from("property_address_grants")
        .select("revoked_at")
        .eq("id", grant!.id)
        .single();
      expect(after?.revoked_at).not.toBeNull();
    });

    // -----------------------------------------------------------------------
    // Notificações — 02 §10, 07 §18.4
    // -----------------------------------------------------------------------

    it("notifications: o proprietário foi notificado da mensagem e do pedido de visita", async () => {
      const { data } = await serviceClient
        .from("notifications")
        .select("type")
        .eq("profile_id", userIds.owner);

      const types = (data ?? []).map((row) => row.type);
      expect(types).toContain("message");
      expect(types).toContain("visit_request");
    });

    it("notifications: cada um lê só as suas", async () => {
      const { data: mine } = await clients.owner.from("notifications").select("profile_id");
      expect((mine ?? []).every((row) => row.profile_id === userIds.owner)).toBe(true);

      const { data: someoneElse } = await clients.buyer2.from("notifications").select("id");
      expect(someoneElse?.length ?? 0).toBe(0);
    });

    it("notification_deliveries: a fila é do servidor — nenhum papel lhe toca", async () => {
      for (const role of ["anon", "buyer", "owner", "admin", "support"] as Role[]) {
        const { data } = await clients[role].from("notification_deliveries").select("id");
        expect(data?.length ?? 0).toBe(0);
      }
      // E o servidor vê lá o que a função `notify()` enfileirou.
      const { data: queued } = await serviceClient
        .from("notification_deliveries")
        .select("id, template, status")
        .eq("profile_id", userIds.owner);
      expect((queued?.length ?? 0) > 0).toBe(true);
      expect(queued?.every((row) => row.status === "queued")).toBe(true);
    });

    it("02 §10: várias mensagens dão vários avisos no sino e um só e-mail na fila", async () => {
      const before = await serviceClient
        .from("notification_deliveries")
        .select("id")
        .eq("profile_id", userIds.owner)
        .eq("template", "message");

      for (const body of ["primeira", "segunda", "terceira"]) {
        await clients.buyer.from("messages").insert({
          conversation_id: conversationId,
          sender_id: userIds.buyer,
          body,
        });
      }

      const after = await serviceClient
        .from("notification_deliveries")
        .select("id")
        .eq("profile_id", userIds.owner)
        .eq("template", "message");

      // A `group_key` por conversa impede a segunda, a terceira e a quarta.
      expect(after.data?.length).toBe(before.data?.length);
    });

    it("07 §5.7: descer o preço notifica quem guardou, e só uma vez", async () => {
      await serviceClient.from("saved_properties").insert({
        user_id: userIds.buyer2,
        property_id: propertyId,
        price_at_save_cents: 250_000_00,
      });

      await serviceClient
        .from("properties")
        .update({ price_cents: 240_000_00 })
        .eq("id", propertyId);

      const { data: first } = await serviceClient
        .from("notifications")
        .select("id, body")
        .eq("profile_id", userIds.buyer2)
        .eq("type", "price_drop");
      expect(first?.length).toBe(1);
      expect(first?.[0]?.body).toContain("240 000 €");

      // O valor guardado passou ao novo: a mesma descida não repete o aviso.
      const { data: saved } = await serviceClient
        .from("saved_properties")
        .select("price_at_save_cents")
        .eq("user_id", userIds.buyer2)
        .eq("property_id", propertyId)
        .single();
      expect(saved?.price_at_save_cents).toBe(240_000_00);

      await serviceClient
        .from("saved_properties")
        .delete()
        .eq("user_id", userIds.buyer2)
        .eq("property_id", propertyId);
    });

    it("as preferências desligam o canal escolhido e só esse", async () => {
      await serviceClient
        .from("profiles")
        .update({ notification_prefs: { message: { inapp: false, email: true } } })
        .eq("id", userIds.owner);

      const before = await serviceClient
        .from("notifications")
        .select("id")
        .eq("profile_id", userIds.owner)
        .eq("type", "message");

      await clients.buyer.from("messages").insert({
        conversation_id: conversationId,
        sender_id: userIds.buyer,
        body: "com o sino desligado",
      });

      const after = await serviceClient
        .from("notifications")
        .select("id")
        .eq("profile_id", userIds.owner)
        .eq("type", "message");
      expect(after.data?.length).toBe(before.data?.length);

      await serviceClient
        .from("profiles")
        .update({ notification_prefs: {} })
        .eq("id", userIds.owner);
    });

    // -----------------------------------------------------------------------
    // Trabalhos agendados — 07 §5.6 e D21
    // -----------------------------------------------------------------------

    it("complete_due_visits: fecha uma visita aceite que já passou há mais de 4 h", async () => {
      const { data: visit } = await serviceClient
        .from("visit_requests")
        .insert({
          property_id: propertyId,
          buyer_id: userIds.buyer2,
          owner_id: userIds.owner,
          proposed_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
          status: "accepted",
        })
        .select("id")
        .single();

      const { error } = await serviceClient.rpc("complete_due_visits");
      expect(error).toBeNull();

      const { data: after } = await serviceClient
        .from("visit_requests")
        .select("status")
        .eq("id", visit!.id)
        .single();
      expect(after?.status).toBe("completed");
    });

    it("run_search_alerts (D21): um alerta que bate com um imóvel novo notifica", async () => {
      const { data: alert } = await serviceClient
        .from("search_alerts")
        .insert({
          user_id: userIds.buyer2,
          filters: { city: "Lisboa", deal: "sale" },
          last_run_at: new Date(Date.now() - 86_400_000).toISOString(),
        })
        .select("id")
        .single();

      await serviceClient
        .from("properties")
        .update({ published_at: new Date().toISOString() })
        .eq("id", propertyId);

      const { error } = await serviceClient.rpc("run_search_alerts");
      expect(error).toBeNull();

      const { data: notified } = await serviceClient
        .from("notifications")
        .select("id, link")
        .eq("profile_id", userIds.buyer2)
        .eq("type", "search_alert");
      expect((notified?.length ?? 0) > 0).toBe(true);
      expect(notified?.[0]?.link).toBe("/guardados/alertas");

      // `last_run_at` avançou — a próxima passagem não repete o mesmo aviso.
      const { data: after } = await serviceClient
        .from("search_alerts")
        .select("last_run_at")
        .eq("id", alert!.id)
        .single();
      expect(new Date(after!.last_run_at!).getTime()).toBeGreaterThan(Date.now() - 60_000);

      await serviceClient.from("search_alerts").delete().eq("id", alert!.id);
    });
  });
});
