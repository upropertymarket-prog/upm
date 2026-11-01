/**
 * Fase 9 — identidade, Termos, subscrição e eliminação de conta (08 §2.3).
 *
 * Uma linha da matriz de acesso por **cada tabela nova** desta fase, como o
 * portão exige: `identity_secrets`, `person_identities`, `offer_redemptions`,
 * `legal_documents`, `terms_acceptances`, `subscription_events` e
 * `account_deletions`.
 *
 * Os fixtures nascem com `service_role`; as tentativas são feitas com sessões
 * `anon`, `buyer`, `owner` e `admin`. Como em `admin-rls.test.ts`, o teste salta
 * inteiro quando faltam credenciais de staging (D13).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasEnv = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

const PASSWORD = "phase9-rls-test-P@ss1";
const USERS = {
  admin: { email: "phase9-admin@upropertymarket.test", role: "admin" },
  owner: { email: "phase9-owner@upropertymarket.test", role: "owner" },
  buyer: { email: "phase9-buyer@upropertymarket.test", role: "buyer" },
} as const;

type Role = keyof typeof USERS | "anon";

/** NIFs de pessoa singular com dígito de controlo válido, para os fixtures. */
const VALID_NIF = "123456789";
const OTHER_NIF = "287689670";

describe.skipIf(!hasEnv)("Fase 9 — matriz RLS e regras de identidade", () => {
  let service: SupabaseClient;
  const clients = {} as Record<Role, SupabaseClient>;
  const ids = {} as Record<keyof typeof USERS, string>;
  let termsDocumentId: string;
  let identityId: string | null = null;
  const createdIdentityIds: string[] = [];

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
      ids[role] = await getOrCreateUser(fixture.email, fixture.role);
      const { error } = await service
        .from("profiles")
        .update({ role: fixture.role, status: "active" })
        .eq("id", ids[role]);
      if (error) throw new Error(`Falha a preparar ${role}: ${error.message}`);

      const client = createClient(SUPABASE_URL!, ANON_KEY!);
      const { error: signInError } = await client.auth.signInWithPassword({
        email: fixture.email,
        password: PASSWORD,
      });
      if (signInError) throw new Error(`Falha a autenticar ${fixture.email}`);
      clients[role] = client;
    }

    const { data: terms, error: termsError } = await service
      .from("legal_documents")
      .select("id")
      .eq("kind", "terms")
      .eq("status", "published")
      .limit(1)
      .maybeSingle();
    if (termsError || !terms) throw new Error("Falta a versão publicada dos Termos (P9-02).");
    termsDocumentId = (terms as { id: string }).id;
  });

  afterAll(async () => {
    if (!service) return;
    // As aceitações e os eventos de subscrição são append-only por desenho: a
    // limpeza faz-se com service_role, que não passa por RLS.
    await service.from("terms_acceptances").delete().in("profile_id", Object.values(ids));
    for (const id of createdIdentityIds) {
      await service.from("offer_redemptions").delete().eq("person_identity_id", id);
      await service
        .from("profiles")
        .update({ person_identity_id: null })
        .eq("person_identity_id", id);
      await service.from("person_identities").delete().eq("id", id);
    }
    await service
      .from("profiles")
      .update({ tax_id: null, tax_id_set_at: null })
      .in("id", Object.values(ids));
  });

  // -------------------------------------------------------------------------
  // P9-01 — identidade
  // -------------------------------------------------------------------------

  it("valida o NIF e recusa um de pessoa coletiva", async () => {
    const { data: ok } = await service.rpc("is_valid_pt_nif", { p_value: VALID_NIF });
    expect(ok).toBe(true);

    // `5…` é pessoa coletiva: a conta é sempre da pessoa (decisão de 7 out 2026).
    const { data: company } = await service.rpc("is_valid_pt_nif", { p_value: "500000000" });
    expect(company).toBe(false);

    // Dígito de controlo errado.
    const { data: broken } = await service.rpc("is_valid_pt_nif", { p_value: "123456788" });
    expect(broken).toBe(false);
  });

  it("register_account_identity grava o NIF e cria a identidade permanente", async () => {
    const { data, error } = await service.rpc("register_account_identity", {
      p_profile_id: ids.buyer,
      p_tax_id: VALID_NIF,
      p_phone: "912345678",
      p_email: USERS.buyer.email,
    });
    expect(error).toBeNull();
    identityId = data as string;
    expect(identityId).toBeTruthy();
    if (identityId) createdIdentityIds.push(identityId);

    const { data: profile } = await service
      .from("profiles")
      .select("tax_id, phone, person_identity_id")
      .eq("id", ids.buyer)
      .single();
    const row = profile as { tax_id: string; phone: string; person_identity_id: string };
    expect(row.tax_id).toBe(VALID_NIF);
    // Normalizado para E.164 — sem isso, o mesmo número daria dois hashes.
    expect(row.phone).toBe("+351912345678");
    expect(row.person_identity_id).toBe(identityId);
  });

  it("a sessão não escreve o NIF no próprio perfil", async () => {
    const { error } = await clients.buyer
      .from("profiles")
      .update({ tax_id: OTHER_NIF })
      .eq("id", ids.buyer);
    // Sem privilégio de coluna, o PostgREST recusa (42501).
    expect(error).not.toBeNull();
  });

  it("dois perfis não partilham NIF", async () => {
    const { error } = await service
      .from("profiles")
      .update({ tax_id: VALID_NIF })
      .eq("id", ids.owner);
    expect(error?.code).toBe("23505");
  });

  it("signup_eligibility recusa um NIF já em uso, com código interno", async () => {
    const { data } = await service.rpc("signup_eligibility", {
      p_tax_id: VALID_NIF,
      p_phone: "912345679",
      p_email: "outra-pessoa@upropertymarket.test",
    });
    const result = data as { allowed: boolean; code?: string };
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("tax_id_in_use");
  });

  // -------------------------------------------------------------------------
  // Matriz de acesso — uma linha por tabela nova (08 §2.3)
  // -------------------------------------------------------------------------

  it("identity_secrets é invisível a toda a gente menos à service_role", async () => {
    for (const role of ["anon", "buyer", "owner", "admin"] as Role[]) {
      const { data, error } = await clients[role].from("identity_secrets").select("key");
      expect(error ?? { message: "sem erro" }).toBeTruthy();
      expect(data ?? []).toHaveLength(0);
    }
    const { data: viaService } = await service.from("identity_secrets").select("key");
    expect((viaService ?? []).length).toBeGreaterThan(0);
  });

  it("person_identities e offer_redemptions não são legíveis por sessão nenhuma", async () => {
    for (const table of ["person_identities", "offer_redemptions"]) {
      for (const role of ["anon", "buyer", "admin"] as Role[]) {
        const { data } = await clients[role].from(table).select("id");
        expect(data ?? []).toHaveLength(0);
      }
    }
  });

  it("legal_documents publicados são públicos; a escrita é só de admin", async () => {
    const { data: anonRead } = await clients.anon
      .from("legal_documents")
      .select("id, version")
      .eq("id", termsDocumentId);
    expect((anonRead ?? []).length).toBe(1);

    // Sem policy de `update`, o RLS filtra a linha: 0 linhas, **sem erro**.
    // Esperar um erro mede a forma da recusa, não a recusa — a prova é que
    // nada foi tocado e o título continua o mesmo.
    const { data: before } = await service
      .from("legal_documents")
      .select("title")
      .eq("id", termsDocumentId)
      .single();
    const { data: touched } = await clients.buyer
      .from("legal_documents")
      .update({ title: "alterado por quem não devia" })
      .eq("id", termsDocumentId)
      .select("id");
    expect(touched ?? []).toHaveLength(0);
    const { data: after } = await service
      .from("legal_documents")
      .select("title")
      .eq("id", termsDocumentId)
      .single();
    expect(after).toEqual(before);
  });

  it("terms_acceptances: cada um vê a sua, ninguém escreve pelo cliente", async () => {
    const { error } = await clients.buyer.rpc("record_terms_acceptance", {
      p_document_id: termsDocumentId,
      p_context: "reacceptance",
      p_ip: null,
      p_user_agent: "vitest",
      p_profile_id: null,
    });
    expect(error).toBeNull();

    const { data: own } = await clients.buyer.from("terms_acceptances").select("id, version");
    expect((own ?? []).length).toBeGreaterThan(0);

    // O comprador não vê as aceitações do proprietário.
    const { data: others } = await clients.buyer
      .from("terms_acceptances")
      .select("id")
      .eq("profile_id", ids.owner);
    expect(others ?? []).toHaveLength(0);

    // Insert direto está revogado.
    const { error: insertError } = await clients.buyer.from("terms_acceptances").insert({
      profile_id: ids.buyer,
      document_id: termsDocumentId,
      document_kind: "terms",
      version: "forjada",
      content_hash: "0".repeat(64),
      context: "registration",
    });
    expect(insertError).not.toBeNull();

    // E aceitar pelo perfil de outra pessoa é recusado.
    const { error: forOther } = await clients.buyer.rpc("record_terms_acceptance", {
      p_document_id: termsDocumentId,
      p_context: "reacceptance",
      p_ip: null,
      p_user_agent: "vitest",
      p_profile_id: ids.owner,
    });
    expect(forOther).not.toBeNull();
  });

  it("subscription_events e account_deletions: leitura própria/admin, escrita nenhuma", async () => {
    const { error: eventInsert } = await clients.buyer.from("subscription_events").insert({
      subscription_id: crypto.randomUUID(),
      profile_id: ids.buyer,
      event: "created",
    });
    expect(eventInsert).not.toBeNull();

    const { data: adminDeletions, error: adminError } = await clients.admin
      .from("account_deletions")
      .select("id");
    expect(adminError).toBeNull();
    expect(Array.isArray(adminDeletions)).toBe(true);

    const { data: buyerDeletions } = await clients.buyer.from("account_deletions").select("id");
    expect(buyerDeletions ?? []).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // D58 / doc 13 — contrato de adesão
  // -------------------------------------------------------------------------

  it("subscription_agreements: leitura própria, escrita nenhuma pela sessão", async () => {
    // Append-only de verdade: a sessão não insere, nem com os seus próprios ids.
    const { error: insert } = await clients.buyer.from("subscription_agreements").insert({
      subscription_id: crypto.randomUUID(),
      profile_id: ids.buyer,
      reference: "UPM-2026-999999",
      plan_name: "Smarter",
      price_cents: 14990,
      interval: "year",
    } as never);
    expect(insert).not.toBeNull();

    // E não lê os dos outros: a policy filtra por `profile_id = auth.uid()`.
    const { data: alheios } = await clients.buyer
      .from("subscription_agreements")
      .select("id")
      .eq("profile_id", ids.owner);
    expect(alheios ?? []).toHaveLength(0);
  });

  it("record_subscription_agreement congela o preço e não se repete em vão", async () => {
    const { data: plan } = await service
      .from("plans")
      .select("id, price_year_cents")
      .eq("slug", "essential-owner")
      .single();
    const { id: planId, price_year_cents: precoContratado } = plan as {
      id: string;
      price_year_cents: number;
    };

    const { data: sub } = await service
      .from("subscriptions")
      .insert({
        profile_id: ids.owner,
        plan_id: planId,
        status: "active",
        interval: "year",
        started_at: new Date().toISOString(),
      } as never)
      .select("id")
      .single();
    const subscriptionId = (sub as { id: string }).id;

    const { data: first } = await service.rpc(
      "record_subscription_agreement" as never,
      {
        p_subscription_id: subscriptionId,
      } as never,
    );
    expect(first).toBeTruthy();

    // Repetir não cria um contrato novo: o Stripe reenvia eventos.
    const { data: again } = await service.rpc(
      "record_subscription_agreement" as never,
      {
        p_subscription_id: subscriptionId,
      } as never,
    );
    expect(again).toBe(first);

    // O preço do plano muda no Admin — e o contrato NÃO muda com ele. É a
    // razão de existir desta tabela.
    await service
      .from("plans")
      .update({ price_year_cents: precoContratado + 2000 } as never)
      .eq("id", planId);

    const { data: agreement } = await service
      .from("subscription_agreements")
      .select("price_cents, plan_name")
      .eq("id", first as string)
      .single();
    expect((agreement as { price_cents: number }).price_cents).toBe(precoContratado);

    await service
      .from("plans")
      .update({ price_year_cents: precoContratado } as never)
      .eq("id", planId);
    await service.from("subscription_agreements").delete().eq("subscription_id", subscriptionId);
    await service.from("subscriptions").delete().eq("id", subscriptionId);
  });

  // -------------------------------------------------------------------------
  // P9-03 / P9-04 — compromisso e porta única do cancelamento
  // -------------------------------------------------------------------------

  it("o compromisso mínimo nasce do global e funciona com 0 e > 0", async () => {
    const { data: plan } = await service
      .from("plans")
      .select("id")
      .eq("slug", "essential-owner")
      .single();
    const planId = (plan as { id: string }).id;

    const { data: created, error } = await service
      .from("subscriptions")
      .insert({ profile_id: ids.owner, plan_id: planId, status: "active", interval: "month" })
      .select("id, minimum_commitment_months, commitment_ends_at, started_at")
      .single();
    expect(error).toBeNull();
    const row = created as {
      id: string;
      minimum_commitment_months: number | null;
      commitment_ends_at: string | null;
      started_at: string;
    };

    // Sem valor no plano, vale o global de `app_settings` — 12 meses por
    // decisão do cliente de 7 out 2026 (P9-03). Até 1 nov este teste esperava
    // `null`, de antes dessa decisão; lê-se o global em vez de o repetir aqui,
    // para o teste seguir a configuração e não uma cópia dela.
    const { data: setting } = await service
      .from("app_settings")
      .select("value")
      .eq("key", "subscription_default_commitment_months")
      .single();
    const global = (setting as { value: number | null } | null)?.value ?? null;
    expect(row.minimum_commitment_months).toBe(global);
    if (global && global > 0) expect(row.commitment_ends_at).toBeTruthy();
    else expect(row.commitment_ends_at).toBeNull();
    expect(row.started_at).toBeTruthy();

    // 0 = "definido como nenhum": continua sem data de fim.
    const { data: zero } = await service
      .from("subscriptions")
      .update({ minimum_commitment_months: 0 })
      .eq("id", row.id)
      .select("commitment_ends_at")
      .single();
    expect((zero as { commitment_ends_at: string | null }).commitment_ends_at).toBeNull();

    // > 0 = calcula o fim a partir do início.
    const { data: twelve } = await service
      .from("subscriptions")
      .update({ minimum_commitment_months: 12 })
      .eq("id", row.id)
      .select("commitment_ends_at")
      .single();
    expect((twelve as { commitment_ends_at: string | null }).commitment_ends_at).toBeTruthy();

    // A porta única permite sempre nesta fase — nenhum bloqueio implementado.
    const { data: decision, error: decisionError } = await clients.owner.rpc(
      "can_cancel_subscription",
      { p_subscription_id: row.id },
    );
    expect(decisionError).toBeNull();
    expect((decision as { allowed: boolean }).allowed).toBe(true);

    // E não responde sobre a subscrição de outra pessoa.
    const { error: foreign } = await clients.buyer.rpc("can_cancel_subscription", {
      p_subscription_id: row.id,
    });
    expect(foreign).not.toBeNull();

    // O histórico nasceu por gatilho, sem ninguém o escrever.
    const { data: events } = await service
      .from("subscription_events")
      .select("event")
      .eq("subscription_id", row.id);
    const kinds = (events ?? []).map((event) => (event as { event: string }).event);
    expect(kinds).toContain("created");
    expect(kinds).toContain("commitment_changed");

    await service.from("subscription_events").delete().eq("subscription_id", row.id);
    await service.from("subscriptions").delete().eq("id", row.id);
  });

  // -------------------------------------------------------------------------
  // P9-05 — fim do Gratuito
  // -------------------------------------------------------------------------

  it("nenhum plano a 0 € está visível, e sem subscrição os limites são zero", async () => {
    const { data: freeVisible } = await service
      .from("plans")
      .select("slug")
      .eq("visible", true)
      .eq("price_month_cents", 0)
      .eq("price_year_cents", 0);
    expect(freeVisible ?? []).toHaveLength(0);

    // `profiles.plan_id` a null + sem subscrição ativa = zero em tudo.
    await service.from("profiles").update({ plan_id: null }).eq("id", ids.buyer);
    const { data: limits } = await service.rpc("effective_limits", { p_profile_id: ids.buyer });
    expect(limits).toMatchObject({
      active_properties: 0,
      visits: 0,
      active_chats: 0,
      saved: 0,
      alerts: 0,
      cloud_gb: 0,
    });

    const { data: entitled } = await service.rpc("subscription_entitled", {
      p_profile_id: ids.buyer,
    });
    expect(entitled).toBe(false);
  });

  it("não há direito a trial", async () => {
    const { data } = await service.rpc("trial_eligible", { p_profile_id: ids.buyer });
    expect(data).toBe(false);
  });
});
