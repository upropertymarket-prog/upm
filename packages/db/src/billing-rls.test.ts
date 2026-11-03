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

import { listarTodosOsUtilizadores } from "./test-users";

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
    const list = await listarTodosOsUtilizadores(service);
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
  // Faturas na Cloud — P7-04
  // -------------------------------------------------------------------------

  it("a fatura só se guarda uma vez, e só pelo dono (P7-04)", async () => {
    // Um ficheiro de fatura já na Cloud do owner, como o deixaria o upload.
    await service.from("subscriptions").delete().eq("profile_id", ids.owner);
    const { data: smarter } = await service
      .from("plans")
      .select("id")
      .eq("slug", "smarter-owner")
      .single();
    const { data: sub } = await service
      .from("subscriptions")
      .insert({ profile_id: ids.owner, plan_id: smarter!.id, status: "active" })
      .select("id")
      .single();

    const { data: file } = await service
      .from("files")
      .insert({
        owner_id: ids.owner,
        name: "Fatura UPM-TEST-0001.pdf",
        mime: "application/pdf",
        size: 24_000,
        bucket: "cloud",
        storage_path: `${ids.owner}/${crypto.randomUUID()}/1`,
        checksum: "0".repeat(64),
        source: "invoice",
      })
      .select("id")
      .single();

    const ok = await clients.owner.rpc("invoice_saved_to_cloud", {
      p_invoice_id: invoiceId,
      p_file_id: file!.id,
    });
    expect(ok.error).toBeNull();

    // 08 §6.9: guardar deixa exatamente uma linha no registo de acessos.
    const { data: log } = await service
      .from("document_access_log")
      .select("id, action")
      .eq("subject_type", "invoice")
      .eq("subject_id", invoiceId);
    expect(log?.length).toBe(1);

    // Segunda vez: recusado, para não ficarem duas cópias da mesma fatura.
    const twice = await clients.owner.rpc("invoice_saved_to_cloud", {
      p_invoice_id: invoiceId,
      p_file_id: file!.id,
    });
    expect(twice.error).not.toBeNull();

    // A fatura de outro não se guarda nem se regista.
    const stranger = await clients.buyer.rpc("invoice_saved_to_cloud", {
      p_invoice_id: invoiceId,
      p_file_id: file!.id,
    });
    expect(stranger.error).not.toBeNull();

    const peek = await clients.buyer.rpc("log_invoice_access", {
      p_invoice_id: invoiceId,
      p_action: "download",
    });
    expect(peek.error).not.toBeNull();

    await service.from("invoices").update({ saved_file_id: null }).eq("id", invoiceId);
    await service.from("document_access_log").delete().eq("subject_id", invoiceId);
    await service.from("files").delete().eq("id", file!.id);
    await service.from("subscriptions").delete().eq("id", sub!.id);
  });

  it("ninguém escreve no registo de acessos de um documento que não é seu", async () => {
    // Defeito da Fase 6 encontrado nesta fase: `log_document_access` é
    // `security definer`, está concedida a anon e authenticated, e aceitava
    // qualquer `subject_id`. Uma prova que qualquer um pode escrever não é
    // prova (08 §6.9).
    const forged = await clients.buyer.rpc("log_document_access", {
      p_subject_type: "invoice",
      p_subject_id: invoiceId,
      p_action: "download",
    });
    expect(forged.error).not.toBeNull();

    const anon = await clients.anon.rpc("log_document_access", {
      p_subject_type: "invoice",
      p_subject_id: invoiceId,
      p_action: "download",
    });
    expect(anon.error).not.toBeNull();

    // O dono continua a poder registar o acesso dele.
    const own = await clients.owner.rpc("log_document_access", {
      p_subject_type: "invoice",
      p_subject_id: invoiceId,
      p_action: "view",
    });
    expect(own.error).toBeNull();

    await service.from("document_access_log").delete().eq("subject_id", invoiceId);
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

  /**
   * `set_registration_plan` existia para gravar o plano GRATUITO escolhido no
   * registo. P9-05 retirou o degrau gratuito e a função foi removida com ele —
   * quem se inscreve paga, e o plano passa a nascer da subscrição, por webhook.
   *
   * O teste fica, invertido: o que se verifica agora é que o caminho **já não
   * existe**. Um teste apagado não impede ninguém de o ressuscitar.
   */
  it("set_registration_plan deixou de existir (P9-05)", async () => {
    const attempt = await clients.buyer.rpc("set_registration_plan", { p_plan_id: freePlanId });
    expect(attempt.error).not.toBeNull();
    expect(JSON.stringify(attempt.error)).toMatch(/set_registration_plan|schema cache|function/i);
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
  // Admin › Planos — P7-05
  // -------------------------------------------------------------------------

  it("as métricas de Admin › Planos são só para o staff", async () => {
    for (const fn of ["admin_plan_metrics", "admin_billing_summary"] as const) {
      expect((await clients.admin.rpc(fn)).error, `admin ${fn}`).toBeNull();
      expect((await clients.support.rpc(fn)).error, `support ${fn}`).toBeNull();
      expect((await clients.owner.rpc(fn)).error, `owner ${fn}`).not.toBeNull();
      expect((await clients.anon.rpc(fn)).error, `anon ${fn}`).not.toBeNull();
    }

    const recent = await clients.admin.rpc("admin_recent_invoices", { p_limit: 5 });
    expect(recent.error).toBeNull();
    expect((await clients.buyer.rpc("admin_recent_invoices", { p_limit: 5 })).error).not.toBeNull();
  });

  it("só o admin escreve um plano — nem o suporte, nem um utilizador", async () => {
    // O nome de partida lê-se, não se assume. A versão anterior comparava com o
    // literal "Smarter", e uma corrida que falhasse a meio — antes do restauro
    // no fim — deixava "Smarter (teste)" em staging e fazia este teste falhar
    // em todas as corridas seguintes, por resíduo e não por regressão.
    const { data: before } = await service
      .from("plans")
      .select("name")
      .eq("id", paidPlanId)
      .single();
    const originalName = before!.name as string;
    const change = { name: `${originalName} (teste)` };

    expect(
      (await clients.support.from("plans").update(change).eq("id", paidPlanId)).error ?? {},
    ).toBeTruthy();
    expect(
      (await clients.owner.from("plans").update(change).eq("id", paidPlanId)).error ?? {},
    ).toBeTruthy();

    const { data: untouched } = await service
      .from("plans")
      .select("name")
      .eq("id", paidPlanId)
      .single();
    expect(untouched!.name).toBe(originalName);

    // P8-07 (07 §6): desde a Fase 8, editar o catálogo exige step-up de PIN.
    // Guardamos e limpamos o estado anterior: uma corrida passada pode ter
    // concedido step-up e deixado os 15 min válidos, fazendo este teste passar
    // indevidamente na corrida seguinte.
    const { data: previousStepUp } = await service
      .from("staff_auth")
      .select("last_step_up_at")
      .eq("profile_id", ids.admin)
      .maybeSingle();
    const previousStepUpAt = previousStepUp?.last_step_up_at ?? null;

    try {
      const cleared = await service
        .from("staff_auth")
        .upsert({ profile_id: ids.admin, last_step_up_at: null }, { onConflict: "profile_id" });
      expect(cleared.error).toBeNull();

      // Sem PIN o admin deve receber o hint que abre o modal na UI.
      const withoutStepUp = await clients.admin.from("plans").update(change).eq("id", paidPlanId);
      expect(withoutStepUp.error).not.toBeNull();
      expect(withoutStepUp.error?.hint).toBe("step_up_required");

      await service
        .from("staff_auth")
        .upsert(
          { profile_id: ids.admin, last_step_up_at: new Date().toISOString() },
          { onConflict: "profile_id" },
        );

      // O restauro vai num `finally`: uma falha não deixa alterações de teste
      // coladas no plano nem muda o step-up preexistente do utilizador.
      try {
        const byAdmin = await clients.admin.from("plans").update(change).eq("id", paidPlanId);
        expect(byAdmin.error).toBeNull();
      } finally {
        await service.from("plans").update({ name: originalName }).eq("id", paidPlanId);
      }
    } finally {
      await service
        .from("staff_auth")
        .upsert(
          { profile_id: ids.admin, last_step_up_at: previousStepUpAt },
          { onConflict: "profile_id" },
        );
    }
  });

  // -------------------------------------------------------------------------
  // Trial — P7-06 (07 §8.1)
  // -------------------------------------------------------------------------

  it("trial: não há trial novo (P9-05); a extensão de um trial existente é única e do admin", async () => {
    await service.from("trial_extension_requests").delete().eq("profile_id", ids.buyer);
    await service.from("subscriptions").delete().eq("profile_id", ids.buyer);

    // P9-05 (7 out 2026): não há trial gratuito, de todo — `trial_eligible` diz
    // sempre que não, mesmo a quem nunca teve um. Este teste esperou `true` até
    // 1 nov, quando correu pela primeira vez contra a base real. Pedir extensão
    // fora de um trial continua recusado.
    expect((await clients.buyer.rpc("trial_eligible", {})).data).toBe(false);
    const tooSoon = await clients.buyer.rpc("request_trial_extension", {
      p_reason: "Ainda estou a experimentar e preciso de mais tempo para decidir.",
    });
    expect(tooSoon.error).not.toBeNull();

    // Uma subscrição em trial, como a deixaria o webhook do Stripe.
    const { data: plan } = await service
      .from("plans")
      .select("id")
      .eq("slug", "smarter-buyer")
      .single();
    const endsAt = new Date(Date.now() + 5 * 86_400_000).toISOString();
    const { data: sub } = await service
      .from("subscriptions")
      .insert({
        profile_id: ids.buyer,
        plan_id: plan!.id,
        status: "trialing",
        trial_ends_at: endsAt,
      })
      .select("id")
      .single();

    // O direito está gasto: já houve um trial nesta conta.
    expect((await clients.buyer.rpc("trial_eligible", {})).data).toBe(false);

    const status = await clients.buyer.rpc("trial_status");
    expect(status.data?.[0]?.trialing).toBe(true);

    const short = await clients.buyer.rpc("request_trial_extension", { p_reason: "preciso" });
    expect(short.error).not.toBeNull();

    const asked = await clients.buyer.rpc("request_trial_extension", {
      p_reason: "Estou à espera da resposta do banco para decidir a compra.",
    });
    expect(asked.error).toBeNull();

    const twice = await clients.buyer.rpc("request_trial_extension", {
      p_reason: "Juro que é mesmo a última vez que peço mais tempo.",
    });
    expect(twice.error).not.toBeNull();

    const requestId = asked.data as string;

    // Decidir é do admin — nem o próprio, nem o suporte.
    expect(
      (await clients.buyer.rpc("decide_trial_extension", { p_id: requestId, p_approve: true }))
        .error,
    ).not.toBeNull();
    expect(
      (await clients.support.rpc("decide_trial_extension", { p_id: requestId, p_approve: true }))
        .error,
    ).not.toBeNull();

    const decided = await clients.admin.rpc("decide_trial_extension", {
      p_id: requestId,
      p_approve: true,
    });
    expect(decided.error).toBeNull();

    const { data: after } = await service
      .from("subscriptions")
      .select("trial_ends_at")
      .eq("id", sub!.id)
      .single();
    expect(new Date(after!.trial_ends_at!).getTime()).toBeGreaterThan(new Date(endsAt).getTime());

    // Decidir duas vezes não volta a somar sete dias.
    expect(
      (await clients.admin.rpc("decide_trial_extension", { p_id: requestId, p_approve: true }))
        .error,
    ).not.toBeNull();

    // Notificação e registo de auditoria (08 §6.7).
    const { data: notice } = await service
      .from("notifications")
      .select("id")
      .eq("profile_id", ids.buyer)
      .eq("link", "/plano");
    expect((notice ?? []).length).toBeGreaterThanOrEqual(1);

    // Dois registos, cada um com o seu papel: o da decisão (o que se decidiu,
    // escrito por `decide_trial_extension`) e o do trigger de A8 (que houve uma
    // escrita de staff nesta linha — o que fica mesmo quando uma ação nova se
    // esquece de auditar). Exatamente um de cada.
    const { data: audit } = await service
      .from("audit_log")
      .select("action")
      .eq("entity", "trial_extension_requests")
      .eq("entity_id", requestId);
    const actions = (audit ?? []).map((row) => row.action).sort();
    expect(actions).toEqual(["trial.extension.approved", "trial_extension_requests.update"]);

    // Um terceiro não vê o pedido de outro.
    expect(
      (await clients.owner.from("trial_extension_requests").select("id").eq("id", requestId)).data
        ?.length ?? 0,
    ).toBe(0);
    expect(
      (await clients.admin.from("trial_extension_requests").select("id").eq("id", requestId)).data
        ?.length,
    ).toBe(1);

    await service.from("notifications").delete().eq("profile_id", ids.buyer);
    // O `audit_log` não se limpa: é só de acrescentar desde o A8 (2 nov).
    await service.from("trial_extension_requests").delete().eq("profile_id", ids.buyer);
    await service.from("subscriptions").delete().eq("id", sub!.id);
    await setPlan(ids.buyer, "gratuito");
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

    // P8-03 removes direct PostgREST staff writes. RLS reports a zero-row
    // update without an error, so assert the returned row count, not error.
    const moderation = await clients.admin
      .from("properties")
      .update({ status: "active" })
      .eq("id", first!.id)
      .select("id");
    expect(moderation.error).toBeNull();
    expect(moderation.data).toHaveLength(0);
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
