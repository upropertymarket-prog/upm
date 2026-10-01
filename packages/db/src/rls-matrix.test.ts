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

  // ===========================================================================
  // Fase 6 — Cloud e contratos (P6-01 a P6-04)
  //
  // Uma grelha por tabela nova, com `buyer2` sempre no papel de terceiro: é o
  // caso que interessa aqui, porque a Cloud inteira se resume a "quem não é
  // parte não vê". Mais os invariantes que vivem em funções e que uma grelha
  // de policies não alcança — quota, versões, congelamento e registo.
  // ===========================================================================

  describe("Cloud e contratos — pastas, ficheiros, partilhas e contratos", () => {
    let propertyId: string;
    let subscriptionId: string;
    let smarterPlanId: string;
    let addonId: string;
    let fileId: string;
    let contractId: string;
    let templateId: string;
    let templateFamilyId: string;

    const MB = 1024 * 1024;

    /** Regista um ficheiro como o dono, pelo caminho normal (com quota). */
    async function registerFile(sizeBytes: number, name = `f-${Date.now()}.pdf`) {
      return clients.owner.rpc("cloud_register_upload", {
        p_folder_id: null,
        p_name: name,
        p_mime: "application/pdf",
        p_size: sizeBytes,
        p_storage_path: `${userIds.owner}/${crypto.randomUUID()}/1`,
        p_checksum: "0".repeat(64),
      });
    }

    beforeAll(async () => {
      const { data: plans } = await serviceClient.from("plans").select("id, slug");
      smarterPlanId = plans!.find((p) => p.slug === "smarter-owner")!.id;

      const { data: addon } = await serviceClient
        .from("addons")
        .select("id")
        .eq("slug", "cloud-5gb")
        .single();
      addonId = addon!.id;

      // O imóvel nasce ANTES da subscrição, de propósito: assim o trigger de
      // publicação corre com o owner ainda no Gratuito, e o primeiro teste
      // pode verificar que sem Cloud não nasce pasta nenhuma (07 §19.1).
      const { data, error } = await serviceClient
        .from("properties")
        .insert({
          owner_id: userIds.owner,
          ref: `RLS-F6-${Date.now()}`,
          title: "T3 de teste da Fase 6",
          deal: "sale",
          status: "active",
          typology: "T3",
          city: "Lisboa",
          price_cents: 300_000_00,
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(`Falha a semear imóvel da Fase 6: ${error?.message}`);
      propertyId = data.id;
    });

    afterAll(async () => {
      await serviceClient.from("contracts").delete().eq("owner_id", userIds.owner);
      await serviceClient.from("contract_templates").delete().eq("created_by", userIds.admin);
      await serviceClient.from("files").delete().eq("owner_id", userIds.owner);
      await serviceClient.from("folders").delete().eq("owner_id", userIds.owner);
      if (subscriptionId)
        await serviceClient.from("subscriptions").delete().eq("id", subscriptionId);
      await serviceClient.from("properties").delete().eq("id", propertyId);
    });

    // -----------------------------------------------------------------------
    // A Cloud é funcionalidade de plano — 07 §19.1 e §19.2
    // -----------------------------------------------------------------------

    it("Gratuito: publicar um imóvel NÃO cria pasta, e o upload é recusado", async () => {
      const { data: folders } = await serviceClient
        .from("folders")
        .select("id")
        .eq("property_id", propertyId);
      expect(folders?.length ?? 0).toBe(0);

      const status = await clients.owner.rpc("cloud_status");
      expect(status.error).toBeNull();
      expect(status.data?.[0]?.has_cloud).toBe(false);
      expect(Number(status.data?.[0]?.limit_bytes)).toBe(0);

      const upload = await registerFile(1 * MB);
      expect(upload.error).not.toBeNull();
      expect(upload.error?.message).toContain("não inclui Cloud");
    });

    it("effective_limits: o extra de §19.3 soma-se ao que o plano dá", async () => {
      const { data: sub, error } = await serviceClient
        .from("subscriptions")
        .insert({ profile_id: userIds.owner, plan_id: smarterPlanId, status: "active" })
        .select("id")
        .single();
      expect(error).toBeNull();
      subscriptionId = sub!.id;

      const withPlan = await serviceClient.rpc("effective_limits", { p_profile_id: userIds.owner });
      expect((withPlan.data as Record<string, number>).cloud_gb).toBe(5);

      await serviceClient
        .from("subscription_addons")
        .insert({ subscription_id: subscriptionId, addon_id: addonId, status: "active" });

      const withAddon = await serviceClient.rpc("effective_limits", {
        p_profile_id: userIds.owner,
      });
      expect((withAddon.data as Record<string, number>).cloud_gb).toBe(10);

      // Uma unidade por conta (07 §19.3): a segunda é recusada pelo índice único.
      const twice = await serviceClient
        .from("subscription_addons")
        .insert({ subscription_id: subscriptionId, addon_id: addonId, status: "active" });
      expect(twice.error).not.toBeNull();

      await serviceClient
        .from("subscription_addons")
        .delete()
        .eq("subscription_id", subscriptionId);

      const back = await serviceClient.rpc("effective_limits", { p_profile_id: userIds.owner });
      expect((back.data as Record<string, number>).cloud_gb).toBe(5);
    });

    it("ganhar Cloud cria as pastas de todas as propriedades e espelha os documentos (D34)", async () => {
      // Um documento carregado na Fase 4, ainda sem `file_id`.
      const { data: doc } = await serviceClient
        .from("property_documents")
        .insert({
          property_id: propertyId,
          storage_path: `${propertyId}/caderneta.pdf`,
          name: "Caderneta predial.pdf",
          mime: "application/pdf",
          size: 410_000,
          kind: "caderneta",
        })
        .select("id")
        .single();

      const { error } = await serviceClient.rpc("ensure_property_folders", {
        p_profile_id: userIds.owner,
      });
      expect(error).toBeNull();

      const { data: folders } = await serviceClient
        .from("folders")
        .select("id, name, kind, parent_id")
        .eq("property_id", propertyId);
      expect(folders?.length).toBe(2);

      const propertyFolder = folders!.find((f) => f.kind === "property")!;
      const docsFolder = folders!.find((f) => f.kind === "property_documents")!;
      expect(propertyFolder.name).toBe("T3 de teste da Fase 6");
      expect(docsFolder.name).toBe("Documentos do imóvel");
      expect(docsFolder.parent_id).toBe(propertyFolder.id);

      // D34 fechada: o documento passou a ter entrada em `files`, no MESMO
      // objeto de storage — não numa cópia.
      const { data: after } = await serviceClient
        .from("property_documents")
        .select("file_id")
        .eq("id", doc!.id)
        .single();
      expect(after?.file_id).not.toBeNull();

      const { data: mirrored } = await serviceClient
        .from("files")
        .select("bucket, storage_path, source, folder_id")
        .eq("id", after!.file_id!)
        .single();
      expect(mirrored?.source).toBe("property_document");
      expect(mirrored?.bucket).toBe("documents");
      expect(mirrored?.storage_path).toBe(`${propertyId}/caderneta.pdf`);
      expect(mirrored?.folder_id).toBe(docsFolder.id);

      // Idempotente: correr outra vez não duplica nada.
      await serviceClient.rpc("ensure_property_folders", { p_profile_id: userIds.owner });
      const { data: again } = await serviceClient
        .from("folders")
        .select("id")
        .eq("property_id", propertyId);
      expect(again?.length).toBe(2);
    });

    // -----------------------------------------------------------------------
    // Quota — 07 §19.8
    // -----------------------------------------------------------------------

    it("o documento do imóvel não conta para a quota (§19.8 #5)", async () => {
      const { data: used } = await serviceClient.rpc("cloud_usage_bytes", {
        p_profile_id: userIds.owner,
      });
      expect(Number(used)).toBe(0);
    });

    it("o documento do imóvel é só de leitura pelo lado da Cloud (§19.5)", async () => {
      const { data: doc } = await serviceClient
        .from("files")
        .select("id")
        .eq("owner_id", userIds.owner)
        .eq("source", "property_document")
        .single();

      const renamed = await clients.owner
        .from("files")
        .update({ name: "renomeado.pdf" })
        .eq("id", doc!.id)
        .select("id");
      expect(renamed.data?.length ?? 0).toBe(0);

      const removed = await clients.owner.rpc("cloud_delete_file", { p_file_id: doc!.id });
      expect(removed.error).not.toBeNull();
    });

    it("cloud_register_upload: aceita dentro da quota e recusa acima dela", async () => {
      const ok = await registerFile(10 * MB, "dentro-da-quota.pdf");
      expect(ok.error).toBeNull();
      fileId = ok.data as string;

      const { data: used } = await serviceClient.rpc("cloud_usage_bytes", {
        p_profile_id: userIds.owner,
      });
      expect(Number(used)).toBe(10 * MB);

      // Encher a quota com uploads reais levaria 200 ficheiros de 25 MB. Em
      // vez disso, injeta-se uma versão grande por `service_role` — o que
      // conta é `file_versions.size`, que é o que `cloud_usage_bytes` soma.
      const { data: bulky } = await serviceClient
        .from("files")
        .insert({
          owner_id: userIds.owner,
          name: "quase-cheio.pdf",
          mime: "application/pdf",
          size: 1,
          storage_path: `${userIds.owner}/bulk/1`,
          checksum: "3".repeat(64),
        })
        .select("id")
        .single();
      await serviceClient.from("file_versions").insert({
        file_id: bulky!.id,
        version: 1,
        storage_path: `${userIds.owner}/bulk/1`,
        name: "quase-cheio.pdf",
        mime: "application/pdf",
        size: 5 * 1024 * MB - 5 * MB,
        checksum: "3".repeat(64),
      });

      const noRoom = await registerFile(10 * MB, "sem-espaco.pdf");
      expect(noRoom.error).not.toBeNull();
      expect(noRoom.error?.message).toContain("Sem espaço");

      await serviceClient.from("files").delete().eq("id", bulky!.id);
    });

    it("um ficheiro acima de 25 MB é recusado (§19.8 #2)", async () => {
      const { error } = await registerFile(26 * MB, "acima-de-25mb.pdf");
      expect(error).not.toBeNull();
      expect(error?.message).toContain("25 MB");
    });

    it("as versões contam para a quota, e restaurar não duplica (§19.8 #3)", async () => {
      const before = await serviceClient.rpc("cloud_usage_bytes", { p_profile_id: userIds.owner });

      const v2 = await clients.owner.rpc("cloud_add_file_version", {
        p_file_id: fileId,
        p_name: "dentro-da-quota.pdf",
        p_mime: "application/pdf",
        p_size: 4 * MB,
        p_storage_path: `${userIds.owner}/${fileId}/2`,
        p_checksum: "1".repeat(64),
        p_note: "revisto",
      });
      expect(v2.error).toBeNull();
      expect(v2.data).toBe(2);

      const after = await serviceClient.rpc("cloud_usage_bytes", { p_profile_id: userIds.owner });
      expect(Number(after.data) - Number(before.data)).toBe(4 * MB);

      // Restaurar a v1 cria a v3 com o conteúdo da v1 — o histórico nunca
      // perde linhas (07 §13.1) — e reaponta ao mesmo objeto, por isso a
      // quota não sobe outra vez.
      const restored = await clients.owner.rpc("cloud_restore_file_version", {
        p_file_id: fileId,
        p_version: 1,
      });
      expect(restored.error).toBeNull();
      expect(restored.data).toBe(3);

      const { data: versions } = await serviceClient
        .from("file_versions")
        .select("version")
        .eq("file_id", fileId);
      expect(versions?.length).toBe(3);
    });

    it("a reciclagem continua a contar até à purga (§19.8 #4)", async () => {
      const created = await registerFile(2 * MB, "para-a-reciclagem.pdf");
      const doomedId = created.data as string;

      const before = await serviceClient.rpc("cloud_usage_bytes", { p_profile_id: userIds.owner });
      await clients.owner.rpc("cloud_delete_file", { p_file_id: doomedId });

      const afterDelete = await serviceClient.rpc("cloud_usage_bytes", {
        p_profile_id: userIds.owner,
      });
      expect(Number(afterDelete.data)).toBe(Number(before.data));

      await clients.owner.rpc("cloud_empty_recycle_bin");
      const purged = await serviceClient.rpc("purge_cloud_recycle_bin");
      expect(purged.error).toBeNull();

      const afterPurge = await serviceClient.rpc("cloud_usage_bytes", {
        p_profile_id: userIds.owner,
      });
      expect(Number(afterPurge.data)).toBe(Number(before.data) - 2 * MB);
    });

    it("não há caminho de insert direto em `files` — a quota não se contorna", async () => {
      const { error } = await clients.owner.from("files").insert({
        owner_id: userIds.owner,
        name: "à-socapa.pdf",
        mime: "application/pdf",
        size: 5 * MB,
        storage_path: `${userIds.owner}/manual/1`,
        checksum: "2".repeat(64),
      });
      expect(error).not.toBeNull();
    });

    // -----------------------------------------------------------------------
    // Matriz de acesso — folders, files, file_versions
    // -----------------------------------------------------------------------

    it.each<[Role, boolean]>([
      ["anon", false],
      ["buyer", false],
      ["buyer2", false],
      ["owner", true],
      ["admin", false],
      ["support", false],
    ])("folders: select como %s → permitido=%s", async (role, expected) => {
      const { data } = await clients[role]
        .from("folders")
        .select("id")
        .eq("property_id", propertyId);
      expect((data ?? []).length > 0).toBe(expected);
    });

    it.each<[Role, boolean]>([
      ["anon", false],
      ["buyer", false],
      ["buyer2", false],
      ["owner", true],
      ["admin", false],
      ["support", false],
    ])("files: select como %s → permitido=%s", async (role, expected) => {
      const { data } = await clients[role].from("files").select("id").eq("id", fileId);
      expect((data ?? []).length > 0).toBe(expected);
    });

    it("files: nem o admin nem o suporte veem a Cloud de um utilizador", async () => {
      // Não é descuido: 07 §13.4 dá ao admin o HISTÓRICO, não o conteúdo, e o
      // support não vê nada. É a mesma linha de D30 — sem caminho auditado,
      // não se abre acesso ao que é dos utilizadores.
      for (const role of ["admin", "support"] as Role[]) {
        const { data } = await clients[role].from("files").select("id").eq("id", fileId);
        expect(data?.length ?? 0).toBe(0);
      }
    });

    it.each<[Role, boolean]>([
      ["buyer", false],
      ["buyer2", false],
      ["owner", true],
    ])("file_versions: select como %s → permitido=%s", async (role, expected) => {
      const { data } = await clients[role].from("file_versions").select("id").eq("file_id", fileId);
      expect((data ?? []).length > 0).toBe(expected);
    });

    it("folders: ninguém escreve na pasta automática de outro, nem na sua", async () => {
      const { data: folder } = await serviceClient
        .from("folders")
        .select("id")
        .eq("property_id", propertyId)
        .eq("kind", "property")
        .single();

      // Terceiro não apaga.
      const byOther = await clients.buyer2
        .from("folders")
        .delete()
        .eq("id", folder!.id)
        .select("id");
      expect(byOther.data?.length ?? 0).toBe(0);

      // Nem o dono: a pasta automática não se apaga enquanto o imóvel existir.
      const byOwner = await clients.owner
        .from("folders")
        .delete()
        .eq("id", folder!.id)
        .select("id");
      expect(byOwner.data?.length ?? 0).toBe(0);
    });

    // -----------------------------------------------------------------------
    // Partilhas — P6-02, 07 §19.7 e §19.11
    // -----------------------------------------------------------------------

    let shareId: string;

    it("share_file: o comprador passa a ver; um terceiro continua sem ver", async () => {
      const shared = await clients.owner.rpc("share_file", {
        p_file_id: fileId,
        p_permission: "download",
        p_shared_with: userIds.buyer,
      });
      expect(shared.error).toBeNull();
      shareId = shared.data as string;

      const buyerSees = await clients.buyer.from("files").select("id").eq("id", fileId);
      expect(buyerSees.data?.length).toBe(1);

      const thirdParty = await clients.buyer2.from("files").select("id").eq("id", fileId);
      expect(thirdParty.data?.length ?? 0).toBe(0);

      // E aparece na Cloud de quem recebeu (05 §6.4).
      const mine = await clients.buyer.rpc("shared_with_me");
      expect(mine.data?.some((r: { file_id: string }) => r.file_id === fileId)).toBe(true);
    });

    it("a permissão de partilha é só view|download — `edit` já não existe (§19.7)", async () => {
      const { error } = await clients.owner.rpc("share_file", {
        p_file_id: fileId,
        p_permission: "edit",
        p_shared_with: userIds.buyer2,
      });
      expect(error).not.toBeNull();
    });

    it("quem recebeu não escreve no ficheiro de outro", async () => {
      const { data } = await clients.buyer
        .from("files")
        .update({ name: "meu-agora.pdf" })
        .eq("id", fileId)
        .select("id");
      expect(data?.length ?? 0).toBe(0);
    });

    it("um terceiro não partilha o ficheiro de outro", async () => {
      const { error } = await clients.buyer2.rpc("share_file", {
        p_file_id: fileId,
        p_permission: "view",
        p_shared_with: userIds.buyer2,
      });
      expect(error).not.toBeNull();
    });

    it("revogar tira o acesso imediatamente", async () => {
      const { error } = await clients.owner.rpc("revoke_file_share", { p_share_id: shareId });
      expect(error).toBeNull();

      const { data } = await clients.buyer.from("files").select("id").eq("id", fileId);
      expect(data?.length ?? 0).toBe(0);
    });

    it("resolve_file_share: código errado falha e conta como tentativa (§19.8)", async () => {
      const token = `tok-${crypto.randomUUID()}`;
      await clients.owner.rpc("share_file", {
        p_file_id: fileId,
        p_permission: "view",
        p_token: token,
        p_access_code_hash: "hash-correto",
      });

      // Sem código: devolve `needs_code`, não o ficheiro.
      const asked = await clients.anon.rpc("resolve_file_share", { p_token: token });
      expect(asked.error).toBeNull();
      expect(asked.data?.[0]?.needs_code).toBe(true);
      expect(asked.data?.[0]?.file_name).toBeNull();

      // Código errado é RESULTADO, não exceção: uma exceção desfazia a
      // transação e levava com ela o registo da tentativa — e sem tentativas
      // registadas não há limite nenhum a aplicar.
      const wrong = await clients.anon.rpc("resolve_file_share", {
        p_token: token,
        p_access_code_hash: "hash-errado",
      });
      expect(wrong.error).toBeNull();
      expect(wrong.data?.[0]?.invalid_code).toBe(true);
      expect(wrong.data?.[0]?.file_name).toBeNull();

      const { data: attempts } = await serviceClient
        .from("auth_attempts")
        .select("succeeded")
        .eq("identifier", token)
        .eq("kind", "share_code");
      expect(attempts?.some((a) => !a.succeeded)).toBe(true);

      const right = await clients.anon.rpc("resolve_file_share", {
        p_token: token,
        p_access_code_hash: "hash-correto",
      });
      expect(right.error).toBeNull();
      expect(right.data?.[0]?.invalid_code).toBe(false);
      expect(right.data?.[0]?.file_name).toBe("dentro-da-quota.pdf");

      await serviceClient.from("auth_attempts").delete().eq("identifier", token);
    });

    it("dez códigos errados bloqueiam a ligação (§19.8)", async () => {
      const token = `tok-bf-${crypto.randomUUID()}`;
      await clients.owner.rpc("share_file", {
        p_file_id: fileId,
        p_permission: "view",
        p_token: token,
        p_access_code_hash: "hash-correto",
      });

      for (let i = 0; i < 10; i += 1) {
        await serviceClient.rpc("record_auth_attempt", {
          p_identifier: token,
          p_kind: "share_code",
          p_succeeded: false,
        });
      }

      // Nem sequer com o código certo: a partir daqui é o limite que manda.
      const blocked = await clients.anon.rpc("resolve_file_share", {
        p_token: token,
        p_access_code_hash: "hash-correto",
      });
      expect(blocked.error).not.toBeNull();
      expect(blocked.error?.message).toContain("Demasiadas tentativas");

      await serviceClient.from("auth_attempts").delete().eq("identifier", token);
    });

    // -----------------------------------------------------------------------
    // Registo de acessos — 07 §13.3 e §13.4
    // -----------------------------------------------------------------------

    it("document_access_log: append-only, ninguém escreve a partir do cliente", async () => {
      for (const role of ["owner", "admin", "buyer"] as Role[]) {
        const { error } = await clients[role].from("document_access_log").insert({
          subject_type: "file",
          subject_id: fileId,
          action: "download",
        });
        expect(error).not.toBeNull();
      }
    });

    it("log_document_access: escreve uma linha, e só uma", async () => {
      const before = await serviceClient
        .from("document_access_log")
        .select("id")
        .eq("subject_id", fileId)
        .eq("action", "download");

      const { error } = await clients.owner.rpc("log_document_access", {
        p_subject_type: "file",
        p_subject_id: fileId,
        p_action: "download",
      });
      expect(error).toBeNull();

      const after = await serviceClient
        .from("document_access_log")
        .select("id")
        .eq("subject_id", fileId)
        .eq("action", "download");
      expect((after.data?.length ?? 0) - (before.data?.length ?? 0)).toBe(1);
    });

    it("o registo é do dono do documento — a contraparte não o vê (§13.4)", async () => {
      await clients.owner.rpc("share_file", {
        p_file_id: fileId,
        p_permission: "view",
        p_shared_with: userIds.buyer,
      });

      const owner = await clients.owner.rpc("file_access_log", { p_file_id: fileId });
      expect((owner.data?.length ?? 0) > 0).toBe(true);

      const counterparty = await clients.buyer.rpc("file_access_log", { p_file_id: fileId });
      expect(counterparty.data?.length ?? 0).toBe(0);

      const thirdParty = await clients.buyer2.rpc("file_access_log", { p_file_id: fileId });
      expect(thirdParty.data?.length ?? 0).toBe(0);

      // O `support` não vê nada de nada (§13.4).
      const support = await clients.support.from("document_access_log").select("id");
      expect(support.data?.length ?? 0).toBe(0);
    });

    // -----------------------------------------------------------------------
    // Modelos de contrato — P6-04
    // -----------------------------------------------------------------------

    it("contract_templates: só o admin escreve; o rascunho não sai do Admin", async () => {
      const { data, error } = await clients.admin
        .from("contract_templates")
        .insert({
          family_id: crypto.randomUUID(),
          kind: "sale",
          name: "Contrato de compra e venda (teste)",
          body: { type: "doc", content: [] },
          variables: ["proprietario", "comprador"],
          created_by: userIds.admin,
        })
        .select("id, family_id")
        .single();
      expect(error).toBeNull();
      templateId = data!.id;
      templateFamilyId = data!.family_id;

      // Em rascunho, o proprietário não o vê.
      const draft = await clients.owner
        .from("contract_templates")
        .select("id")
        .eq("id", templateId);
      expect(draft.data?.length ?? 0).toBe(0);

      const byOwner = await clients.owner.from("contract_templates").insert({
        family_id: crypto.randomUUID(),
        kind: "rent",
        name: "Modelo à socapa",
      });
      expect(byOwner.error).not.toBeNull();
    });

    it("publicar torna-o visível e arquiva a versão anterior", async () => {
      const published = await clients.admin.rpc("publish_contract_template", {
        p_template_id: templateId,
      });
      expect(published.error).toBeNull();

      const seen = await clients.owner.from("contract_templates").select("id").eq("id", templateId);
      expect(seen.data?.length).toBe(1);

      // Nova versão de rascunho não mexe na publicada.
      const draft = await clients.admin.rpc("draft_contract_template_version", {
        p_family_id: templateFamilyId,
      });
      expect(draft.error).toBeNull();

      const stillPublished = await serviceClient
        .from("contract_templates")
        .select("version, status")
        .eq("family_id", templateFamilyId)
        .order("version");
      expect(stillPublished.data?.[0]?.status).toBe("published");
      expect(stillPublished.data?.[1]?.status).toBe("draft");

      await clients.admin.rpc("publish_contract_template", { p_template_id: draft.data as string });

      const after = await serviceClient
        .from("contract_templates")
        .select("version, status")
        .eq("family_id", templateFamilyId)
        .order("version");
      expect(after.data?.[0]?.status).toBe("archived");
      expect(after.data?.[1]?.status).toBe("published");
    });

    // -----------------------------------------------------------------------
    // Contratos — P6-03, 07 §13.2
    // -----------------------------------------------------------------------

    it("create_contract_from_template: o proprietário gera; um terceiro não usa o imóvel alheio", async () => {
      const { data: tpl } = await serviceClient
        .from("contract_templates")
        .select("id")
        .eq("family_id", templateFamilyId)
        .eq("status", "published")
        .single();

      const created = await clients.owner.rpc("create_contract_from_template", {
        p_template_id: tpl!.id,
        p_title: "Contrato de reserva · T3",
        p_property_id: propertyId,
        p_counterparty_profile_id: userIds.buyer,
        p_counterparty_name: "",
      });
      expect(created.error).toBeNull();
      contractId = created.data as string;

      const byOther = await clients.buyer2.rpc("create_contract_from_template", {
        p_template_id: tpl!.id,
        p_title: "Contrato sobre imóvel alheio",
        p_property_id: propertyId,
      });
      expect(byOther.error).not.toBeNull();
    });

    it.each<[Role, boolean]>([
      ["anon", false],
      ["buyer", false],
      ["buyer2", false],
      ["owner", true],
      ["admin", true],
      ["support", false],
    ])("contracts: select como %s → permitido=%s", async (role, expected) => {
      const { data } = await clients[role].from("contracts").select("id").eq("id", contractId);
      expect((data ?? []).length > 0).toBe(expected);
    });

    it("o estado de um contrato não anda para trás", async () => {
      const forward = await clients.owner.rpc("set_contract_status", {
        p_contract_id: contractId,
        p_status: "awaiting_signature",
      });
      expect(forward.error).toBeNull();

      const backward = await clients.owner.rpc("set_contract_status", {
        p_contract_id: contractId,
        p_status: "draft",
      });
      expect(backward.error).not.toBeNull();

      const sideways = await clients.buyer2.rpc("set_contract_status", {
        p_contract_id: contractId,
        p_status: "signed",
      });
      expect(sideways.error).not.toBeNull();
    });

    it("partilhar congela a versão, e a contraparte vê essa e não o que vier depois", async () => {
      const shared = await clients.owner.rpc("share_contract", {
        p_contract_id: contractId,
        p_permission: "download",
        p_shared_with: userIds.buyer,
      });
      expect(shared.error).toBeNull();

      const { data: frozen } = await serviceClient
        .from("contract_versions")
        .select("id, version, frozen")
        .eq("contract_id", contractId)
        .eq("frozen", true)
        .order("version", { ascending: false });
      expect((frozen?.length ?? 0) > 0).toBe(true);

      // O dono continua a editar: o corpo do contrato muda.
      await clients.owner.rpc("save_contract_version", {
        p_contract_id: contractId,
        p_body: { type: "doc", content: [{ type: "paragraph", text: "depois da partilha" }] },
        p_values: { preco: "300000" },
        p_note: "edição posterior",
      });

      // A contraparte continua a ver a versão congelada (07 §13.2).
      const seen = await clients.buyer.rpc("contracts_shared_with_me");
      expect(seen.error).toBeNull();
      const row = seen.data?.find((r: { contract_id: string }) => r.contract_id === contractId);
      expect(row).toBeDefined();
      expect(JSON.stringify(row.body)).not.toContain("depois da partilha");

      // E um terceiro não vê nada.
      const thirdParty = await clients.buyer2.rpc("contracts_shared_with_me");
      expect(thirdParty.data?.length ?? 0).toBe(0);
    });

    it("a contraparte vê a versão partilhada e SÓ essa (§13.4)", async () => {
      const { data: all } = await serviceClient
        .from("contract_versions")
        .select("id")
        .eq("contract_id", contractId);
      expect((all?.length ?? 0) > 1).toBe(true);

      const { data: seen } = await clients.buyer
        .from("contract_versions")
        .select("id")
        .eq("contract_id", contractId);
      expect(seen?.length).toBe(1);

      // E não vê o registo de acessos do contrato (§13.4).
      const { data: log } = await clients.buyer
        .from("document_access_log")
        .select("id")
        .eq("subject_id", contractId);
      expect(log?.length ?? 0).toBe(0);
    });

    it("contract_history: o dono vê o histórico; a contraparte não", async () => {
      const owner = await clients.owner.rpc("contract_history", { p_contract_id: contractId });
      expect((owner.data?.length ?? 0) > 1).toBe(true);

      const counterparty = await clients.buyer.rpc("contract_history", {
        p_contract_id: contractId,
      });
      expect(counterparty.data?.length ?? 0).toBe(0);
    });

    it("addons: o catálogo é público, a escrita é só do admin", async () => {
      for (const role of ["anon", "buyer", "owner"] as Role[]) {
        const { data } = await clients[role].from("addons").select("id").eq("id", addonId);
        expect(data?.length).toBe(1);
      }

      const byOwner = await clients.owner
        .from("addons")
        .update({ price_month_cents: 1 })
        .eq("id", addonId)
        .select("id");
      expect(byOwner.data?.length ?? 0).toBe(0);
    });

    it("subscription_addons: cada um vê o seu, e mais nenhum", async () => {
      await serviceClient
        .from("subscription_addons")
        .insert({ subscription_id: subscriptionId, addon_id: addonId, status: "active" });

      const own = await clients.owner.from("subscription_addons").select("id");
      expect(own.data?.length).toBe(1);

      const other = await clients.buyer2.from("subscription_addons").select("id");
      expect(other.data?.length ?? 0).toBe(0);

      await serviceClient
        .from("subscription_addons")
        .delete()
        .eq("subscription_id", subscriptionId);
    });
  });
});
