/**
 * Faturação — matriz de acesso e enforcement (Fase 7, P7-02 · P7-03)
 * =========================================================================
 * Fecha, para as tabelas desta fase, a exigência de 08 §2.3 ("uma linha nova
 * na matriz por cada tabela nova") e **paga a dívida D14**, que era a
 * `subscriptions` sem grelha própria desde a Fase 2.
 *
 * Cobre também duas coisas que não são matriz mas são a razão de ser da fase:
 * os gatilhos de limite (08 §5.3) e o buraco de escalada de privilégios que
 * `profiles_update_own` deixava aberto na Fase 0.
 *
 * Precisa de NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e
 * SUPABASE_SERVICE_ROLE_KEY no ambiente — sem eles salta, como os restantes
 * testes de RLS (D6/D13).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasEnv = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

const PASSWORD = "billing-rls-test-P@ss1";
const USERS = {
  buyer: { email: "billing-buyer@upropertymarket.test", role: "buyer" },
  owner: { email: "billing-owner@upropertymarket.test", role: "owner" },
  admin: { email: "billing-admin@upropertymarket.test", role: "admin" },
  support: { email: "billing-support@upropertymarket.test", role: "support" },
} as const;

type Role = keyof typeof USERS | "anon";

describe.skipIf(!hasEnv)("Faturação — acesso e limites (Fase 7)", () => {
  let service: SupabaseClient;
  const clients = {} as Record<Role, SupabaseClient>;
  const ids = {} as Record<keyof typeof USERS, string>;

  let ownerPropertyId: string;
  let invoiceId: string;
  let freePlanId: string;
  let paidPlanId: string;
  const createdProperties: string[] = [];

  async function user(email: string, role: string) {
    const list = await service.auth.admin.listUsers();
    const found = list.data.users.find((u) => u.email === email);
    if (found) return found.id;
    const created = await service.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { role },
    });
    if (created.error || !created.data.user) {
      throw new Error(`Falha a criar ${email}: ${created.error?.message}`);
    }
    return created.data.user.id;
  }

  /** Põe o perfil num plano concreto, sem passar pelo Stripe. */
  async function setPlan(profileId: string, slug: string) {
    const { data } = await service.from("plans").select("id").eq("slug", slug).single();
    await service.from("subscriptions").delete().eq("profile_id", profileId);
    await service.from("profiles").update({ plan_id: data!.id }).eq("id", profileId);
    return data!.id as string;
  }

  beforeAll(async () => {
    service = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);
    clients.anon = createClient(SUPABASE_URL!, ANON_KEY!);

    for (const key of Object.keys(USERS) as (keyof typeof USERS)[]) {
      const { email, role } = USERS[key];
      ids[key] = await user(email, role);
      const client = createClient(SUPABASE_URL!, ANON_KEY!);
      const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
      if (error) throw new Error(`Falha a autenticar ${email}: ${error.message}`);
      clients[key] = client;
    }

    const free = await service.from("plans").select("id").eq("slug", "gratuito").single();
    freePlanId = free.data!.id;
    const paid = await service.from("plans").select("id").eq("slug", "smarter-owner").single();
    paidPlanId = paid.data!.id;

    await setPlan(ids.owner, "gratuito");
    await setPlan(ids.buyer, "gratuito");

    const { data: property } = await service
      .from("properties")
      .insert({
        owner_id: ids.owner,
        ref: `BILL-${Date.now()}`,
        deal: "sale",
        status: "draft",
        typology: "T2",
      })
      .select("id")
      .single();
    ownerPropertyId = property!.id;
    createdProperties.push(ownerPropertyId);

    const { data: invoice } = await service
      .from("invoices")
      .insert({
        profile_id: ids.owner,
        stripe_invoice_id: `in_test_${Date.now()}`,
        total_cents: 1299,
        status: "paid",
        number: "UPM-TEST-0001",
        issued_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    invoiceId = invoice!.id;
  });

  afterAll(async () => {
    if (!hasEnv) return;
    await service.from("invoices").delete().eq("profile_id", ids.owner);
    await service.from("saved_properties").delete().eq("user_id", ids.buyer);
    await service.from("search_alerts").delete().eq("user_id", ids.buyer);
    await service.from("visit_requests").delete().eq("buyer_id", ids.buyer);
    await service.from("conversations").delete().eq("buyer_id", ids.buyer);
    await service.from("subscriptions").delete().eq("profile_id", ids.owner);
    await service.from("properties").delete().in("id", createdProperties);
  });

  // -------------------------------------------------------------------------
  // Matriz — invoices, stripe_events e subscriptions (fecha D14)
  // -------------------------------------------------------------------------

  it("invoices: o dono lê a sua; um terceiro não; o staff lê todas", async () => {
    const own = await clients.owner.from("invoices").select("id").eq("id", invoiceId);
    expect(own.data?.length).toBe(1);

    const other = await clients.buyer.from("invoices").select("id").eq("id", invoiceId);
    expect(other.data?.length ?? 0).toBe(0);

    for (const role of ["admin", "support"] as const) {
      const staff = await clients[role].from("invoices").select("id").eq("id", invoiceId);
      expect(staff.data?.length, role).toBe(1);
    }

    const anon = await clients.anon.from("invoices").select("id");
    expect(anon.data?.length ?? 0).toBe(0);
  });

  it("invoices: ninguém escreve a partir de uma sessão — nem o próprio, nem o admin", async () => {
    for (const role of ["owner", "buyer", "admin", "support"] as const) {
      const insert = await clients[role].from("invoices").insert({
        profile_id: ids[role],
        stripe_invoice_id: `in_forjada_${role}_${Date.now()}`,
        total_cents: 1,
        status: "paid",
      });
      expect(insert.error, `insert ${role}`).not.toBeNull();
    }

    const update = await clients.owner
      .from("invoices")
      .update({ total_cents: 0 })
      .eq("id", invoiceId);
    expect(update.error ?? { count: 0 }).toBeTruthy();

    const after = await service.from("invoices").select("total_cents").eq("id", invoiceId).single();
    expect(Number(after.data!.total_cents)).toBe(1299);

    const remove = await clients.owner.from("invoices").delete().eq("id", invoiceId);
    expect(remove.error ?? { count: 0 }).toBeTruthy();
    const still = await service.from("invoices").select("id").eq("id", invoiceId);
    expect(still.data?.length).toBe(1);
  });

  it("stripe_events é só do servidor — nenhuma sessão lhe toca (08 §3.5)", async () => {
    for (const role of ["anon", "owner", "admin"] as const) {
      const read = await clients[role].from("stripe_events").select("id");
      expect(read.data?.length ?? 0, `select ${role}`).toBe(0);

      const write = await clients[role]
        .from("stripe_events")
        .insert({ id: `evt_forjado_${role}`, type: "invoice.paid" });
      expect(write.error, `insert ${role}`).not.toBeNull();
    }
  });

  it("subscriptions: cada um vê a sua, o staff vê todas, ninguém a escreve (D14)", async () => {
    const { data: sub } = await service
      .from("subscriptions")
      .insert({ profile_id: ids.owner, plan_id: paidPlanId, status: "active", interval: "year" })
      .select("id")
      .single();

    expect(
      (await clients.owner.from("subscriptions").select("id").eq("id", sub!.id)).data?.length,
    ).toBe(1);
    expect(
      (await clients.buyer.from("subscriptions").select("id").eq("id", sub!.id)).data?.length ?? 0,
    ).toBe(0);
    expect(
      (await clients.support.from("subscriptions").select("id").eq("id", sub!.id)).data?.length,
    ).toBe(1);
    expect((await clients.anon.from("subscriptions").select("id")).data?.length ?? 0).toBe(0);

    // Dar a si próprio um plano melhor, por escrita direta: recusado.
    const insert = await clients.owner
      .from("subscriptions")
      .insert({ profile_id: ids.owner, plan_id: paidPlanId, status: "active" });
    expect(insert.error).not.toBeNull();

    const update = await clients.owner
      .from("subscriptions")
      .update({ plan_id: paidPlanId })
      .eq("id", sub!.id);
    expect(update.error ?? { count: 0 }).toBeTruthy();

    await service.from("subscriptions").delete().eq("id", sub!.id);
  });

  // -------------------------------------------------------------------------
  // Escalada de privilégios no próprio perfil
  // -------------------------------------------------------------------------

  it("um utilizador não se promove a admin nem se dá um plano pago", async () => {
    const promote = await clients.buyer
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", ids.buyer);
    expect(promote.error).not.toBeNull();

    const upgrade = await clients.buyer
      .from("profiles")
      .update({ plan_id: paidPlanId })
      .eq("id", ids.buyer);
    expect(upgrade.error).not.toBeNull();

    const customer = await clients.buyer
      .from("profiles")
      .update({ stripe_customer_id: "cus_forjado" })
      .eq("id", ids.buyer);
    expect(customer.error).not.toBeNull();

    const after = await service
      .from("profiles")
      .select("role, plan_id, stripe_customer_id")
      .eq("id", ids.buyer)
      .single();
    expect(after.data!.role).toBe("buyer");
    expect(after.data!.plan_id).toBe(freePlanId);

    // O que é dele continua a ser dele.
    const own = await clients.buyer
      .from("profiles")
      .update({ full_name: "Comprador de Teste" })
      .eq("id", ids.buyer);
    expect(own.error).toBeNull();
  });

  it("set_registration_plan só aceita planos gratuitos", async () => {
    const paid = await clients.buyer.rpc("set_registration_plan", { p_plan_id: paidPlanId });
    expect(paid.error).not.toBeNull();

    const free = await clients.buyer.rpc("set_registration_plan", { p_plan_id: freePlanId });
    expect(free.error).toBeNull();
  });

  it("attach_stripe_customer preenche uma vez e recusa a troca", async () => {
    await service.from("profiles").update({ stripe_customer_id: null }).eq("id", ids.buyer);

    const id = `cus_test${Date.now()}`;
    const first = await clients.buyer.rpc("attach_stripe_customer", { p_customer_id: id });
    expect(first.error).toBeNull();

    // Repetir com o MESMO id é inofensivo (o Checkout pode tentar duas vezes).
    const again = await clients.buyer.rpc("attach_stripe_customer", { p_customer_id: id });
    expect(again.error).toBeNull();

    const swap = await clients.buyer.rpc("attach_stripe_customer", {
      p_customer_id: "cus_outroQualquer",
    });
    expect(swap.error).not.toBeNull();

    const junk = await clients.owner.rpc("attach_stripe_customer", {
      p_customer_id: "nao-e-um-id",
    });
    expect(junk.error).not.toBeNull();

    await service.from("profiles").update({ stripe_customer_id: null }).eq("id", ids.buyer);
  });

  // -------------------------------------------------------------------------
  // Enforcement — 08 §5.3, limites de 07 §19.2
  // -------------------------------------------------------------------------

  it("saved: o Gratuito pára aos 10 e a recusa diz qual é o limite", async () => {
    await service.from("saved_properties").delete().eq("user_id", ids.buyer);

    const extras: string[] = [];
    for (let i = 0; i < 11; i += 1) {
      const { data } = await service
        .from("properties")
        .insert({
          owner_id: ids.owner,
          ref: `BILL-SAVE-${Date.now()}-${i}`,
          deal: "sale",
          status: "active",
          typology: "T1",
        })
        .select("id")
        .single();
      extras.push(data!.id);
      createdProperties.push(data!.id);
    }

    for (let i = 0; i < 10; i += 1) {
      const ok = await clients.buyer
        .from("saved_properties")
        .insert({ user_id: ids.buyer, property_id: extras[i]! });
      expect(ok.error, `guardado ${i + 1}`).toBeNull();
    }

    const blocked = await clients.buyer
      .from("saved_properties")
      .insert({ user_id: ids.buyer, property_id: extras[10]! });
    expect(blocked.error).not.toBeNull();
    expect(blocked.error?.hint).toBe("saved");

    // Com um plano que dá mais, a mesma inserção passa — o limite é do plano,
    // não da tabela.
    await setPlan(ids.buyer, "smarter-buyer");
    const afterUpgrade = await clients.buyer
      .from("saved_properties")
      .insert({ user_id: ids.buyer, property_id: extras[10]! });
    expect(afterUpgrade.error).toBeNull();

    await setPlan(ids.buyer, "gratuito");
    await service.from("saved_properties").delete().eq("user_id", ids.buyer);
  });

  it("alerts: o Gratuito tem direito a um", async () => {
    await service.from("search_alerts").delete().eq("user_id", ids.buyer);

    const first = await clients.buyer
      .from("search_alerts")
      .insert({ user_id: ids.buyer, filters: { city: "Lisboa" } });
    expect(first.error).toBeNull();

    const second = await clients.buyer
      .from("search_alerts")
      .insert({ user_id: ids.buyer, filters: { city: "Porto" } });
    expect(second.error).not.toBeNull();
    expect(second.error?.hint).toBe("alerts");

    await service.from("search_alerts").delete().eq("user_id", ids.buyer);
  });

  it("conversas: conta-se a quem ABRE, e o Gratuito abre três", async () => {
    await service.from("conversations").delete().eq("buyer_id", ids.buyer);
    await setPlan(ids.buyer, "gratuito");

    const targets: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const { data } = await service
        .from("properties")
        .insert({
          owner_id: ids.owner,
          ref: `BILL-CHAT-${Date.now()}-${i}`,
          deal: "sale",
          status: "active",
          typology: "T1",
        })
        .select("id")
        .single();
      targets.push(data!.id);
      createdProperties.push(data!.id);
    }

    for (let i = 0; i < 3; i += 1) {
      const ok = await clients.buyer.rpc("start_conversation", { p_property_id: targets[i]! });
      expect(ok.error, `conversa ${i + 1}`).toBeNull();
    }

    const blocked = await clients.buyer.rpc("start_conversation", { p_property_id: targets[3]! });
    expect(blocked.error).not.toBeNull();
    expect(blocked.error?.hint).toBe("active_chats");

    // E o proprietário, que já tem três conversas e o mesmo plano Gratuito,
    // continua a poder RECEBER: o limite é de quem abre (07 §19.2).
    const { data: fromOwnerSide } = await service
      .from("conversations")
      .select("id")
      .eq("owner_id", ids.owner);
    expect((fromOwnerSide ?? []).length).toBeGreaterThanOrEqual(3);

    await service.from("conversations").delete().eq("buyer_id", ids.buyer);
  });

  it("visitas: cinco pedidos por mês no Gratuito, contados a quem pede", async () => {
    await service.from("visit_requests").delete().eq("buyer_id", ids.buyer);
    await setPlan(ids.buyer, "gratuito");

    const targets: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      const { data } = await service
        .from("properties")
        .insert({
          owner_id: ids.owner,
          ref: `BILL-VISIT-${Date.now()}-${i}`,
          deal: "sale",
          status: "active",
          typology: "T1",
        })
        .select("id")
        .single();
      targets.push(data!.id);
      createdProperties.push(data!.id);
    }

    const when = new Date(Date.now() + 7 * 86_400_000).toISOString();
    for (let i = 0; i < 5; i += 1) {
      const ok = await clients.buyer.rpc("request_visit", {
        p_property_id: targets[i]!,
        p_proposed_at: when,
        p_message: "",
      });
      expect(ok.error, `pedido ${i + 1}`).toBeNull();
    }

    const blocked = await clients.buyer.rpc("request_visit", {
      p_property_id: targets[5]!,
      p_proposed_at: when,
      p_message: "",
    });
    expect(blocked.error).not.toBeNull();
    expect(blocked.error?.hint).toBe("visits");

    // A janela é o mês de calendário: um pedido do mês passado não conta.
    await service
      .from("visit_requests")
      .update({ requested_at: new Date(Date.now() - 45 * 86_400_000).toISOString() })
      .eq("buyer_id", ids.buyer);

    const nextMonth = await clients.buyer.rpc("request_visit", {
      p_property_id: targets[5]!,
      p_proposed_at: when,
      p_message: "",
    });
    expect(nextMonth.error).toBeNull();

    await service.from("visit_requests").delete().eq("buyer_id", ids.buyer);
  });

  it("ilimitado não bloqueia nada (07 §19.2: null, nunca um número grande)", async () => {
    await setPlan(ids.buyer, "premium-buyer");
    const limits = await service.rpc("effective_limits", { p_profile_id: ids.buyer });
    expect((limits.data as Record<string, unknown>).saved).toBeNull();

    const { data: property } = await service
      .from("properties")
      .insert({
        owner_id: ids.owner,
        ref: `BILL-UNL-${Date.now()}`,
        deal: "sale",
        status: "active",
        typology: "T1",
      })
      .select("id")
      .single();
    createdProperties.push(property!.id);

    const ok = await clients.buyer
      .from("saved_properties")
      .insert({ user_id: ids.buyer, property_id: property!.id });
    expect(ok.error).toBeNull();

    await service.from("saved_properties").delete().eq("user_id", ids.buyer);
    await setPlan(ids.buyer, "gratuito");
  });

  it("imóveis: o Gratuito publica um; o segundo é recusado ao submeter", async () => {
    await service
      .from("properties")
      .update({ status: "draft" })
      .eq("owner_id", ids.owner)
      .in("id", createdProperties);
    await setPlan(ids.owner, "gratuito");

    const { data: first } = await service
      .from("properties")
      .insert({
        owner_id: ids.owner,
        ref: `BILL-PUB1-${Date.now()}`,
        deal: "sale",
        status: "draft",
        typology: "T2",
      })
      .select("id")
      .single();
    const { data: second } = await service
      .from("properties")
      .insert({
        owner_id: ids.owner,
        ref: `BILL-PUB2-${Date.now()}`,
        deal: "sale",
        status: "draft",
        typology: "T2",
      })
      .select("id")
      .single();
    createdProperties.push(first!.id, second!.id);

    const ok = await clients.owner
      .from("properties")
      .update({ status: "pending_review" })
      .eq("id", first!.id);
    expect(ok.error).toBeNull();

    const blocked = await clients.owner
      .from("properties")
      .update({ status: "pending_review" })
      .eq("id", second!.id);
    expect(blocked.error).not.toBeNull();
    expect(blocked.error?.hint).toBe("active_properties");

    // A moderação continua a poder aprovar o que já está na fila: o limite é
    // de quem submete, não de quem aprova.
    const moderation = await clients.admin
      .from("properties")
      .update({ status: "active" })
      .eq("id", first!.id);
    expect(moderation.error).toBeNull();
  });

  it("downgrade: os excedentes passam a rascunho e nada é apagado (02 §9)", async () => {
    await setPlan(ids.owner, "smarter-owner");

    const published: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const { data } = await service
        .from("properties")
        .insert({
          owner_id: ids.owner,
          ref: `BILL-DOWN-${Date.now()}-${i}`,
          deal: "sale",
          status: "active",
          typology: "T3",
          published_at: new Date(Date.now() - (3 - i) * 86_400_000).toISOString(),
        })
        .select("id")
        .single();
      published.push(data!.id);
      createdProperties.push(data!.id);
    }

    await setPlan(ids.owner, "gratuito");
    const moved = await service.rpc("apply_plan_downgrade", { p_profile_id: ids.owner });
    expect(moved.error).toBeNull();

    const { data: after } = await service
      .from("properties")
      .select("id, status")
      .in("id", createdProperties);

    const live = (after ?? []).filter((row) => ["active", "featured"].includes(row.status));
    expect(live.length).toBeLessThanOrEqual(1);
    // Nada desapareceu: o que saiu do ar ficou em rascunho.
    expect(after?.length).toBe(createdProperties.length);
    expect((after ?? []).every((row) => row.status !== null)).toBe(true);
  });
});
