/**
 * F4 — os números do menu, contados na base (`my_nav_counters`)
 * =========================================================================
 * As regras eram do `countersFor`, em JS, sobre as listas inteiras; passaram
 * para SQL (`20261103110000_contadores_do_menu.sql`). Este teste prova duas
 * coisas, contra a base:
 *
 *  1. **a mesma definição** — para cada utilizador, o número da função é o que
 *     a regra antiga daria sobre as mesmas listas;
 *  2. **as regras que distinguem casos**, com valores concretos: soma as
 *     mensagens por ler (não as conversas); a visita cuja data fui eu a propor
 *     não conta para mim; uma aceite já não pede resposta; o comprador não tem
 *     leads.
 *
 * Usa os percursos verdadeiros (abrir conversa, mandar mensagem, pedir e
 * reagendar visita), e não linhas inseridas à mão: os leads nascem dos
 * triggers, como em produção.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { grantTestPlan } from "./test-plan-fixture";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasEnv = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

const SENHA = "Nav-Counters-Teste-2026!";
const CARIMBO = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

type Contadores = { messages: number; waiting: number; leads: number };

describe.skipIf(!hasEnv)("F4 · my_nav_counters — contra staging", () => {
  let service: SupabaseClient;
  const ids = { owner: "", buyer: "" };
  const sessoes: Record<"owner" | "buyer", SupabaseClient> = {} as never;
  const imoveis: string[] = [];

  async function conta(papel: "owner" | "buyer"): Promise<string> {
    const email = `nav-${papel}-${CARIMBO}@upropertymarket.test`;
    const { data, error } = await service.auth.admin.createUser({
      email,
      password: SENHA,
      email_confirm: true,
      user_metadata: { role: papel, full_name: `Nav ${papel}` },
    });
    if (error || !data.user) throw new Error(`Falha a criar ${email}: ${error?.message}`);
    await grantTestPlan(
      service,
      data.user.id,
      papel === "owner" ? "premium-owner" : "premium-buyer",
    );
    const cliente = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } });
    const entrada = await cliente.auth.signInWithPassword({ email, password: SENHA });
    if (entrada.error) throw new Error(`Falha a entrar como ${email}: ${entrada.error.message}`);
    sessoes[papel] = cliente;
    return data.user.id;
  }

  async function contadores(papel: "owner" | "buyer"): Promise<Contadores> {
    const { data, error } = await sessoes[papel].rpc("my_nav_counters");
    expect(error).toBeNull();
    return data as Contadores;
  }

  /** A regra antiga do `countersFor`, aplicada às listas que as páginas carregavam. */
  async function pelaRegraAntiga(papel: "owner" | "buyer"): Promise<Contadores> {
    const cliente = sessoes[papel];
    const [{ data: conversas }, { data: visitas }, { data: leads }] = await Promise.all([
      cliente.rpc("my_conversations"),
      cliente.rpc("my_visit_requests"),
      cliente.rpc("my_owner_leads"),
    ]);
    type V = { status: string; proposed_by_me: boolean };
    return {
      messages: (conversas ?? []).reduce(
        (total: number, c: { unread: number }) => total + (c.unread ?? 0),
        0,
      ),
      waiting: ((visitas ?? []) as V[]).filter(
        (v) => (v.status === "pending" || v.status === "rescheduled") && !v.proposed_by_me,
      ).length,
      leads: ((leads ?? []) as { stage: string }[]).filter(
        (l) => l.stage === "new" || l.stage === "contacted",
      ).length,
    };
  }

  beforeAll(async () => {
    service = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);
    ids.owner = await conta("owner");
    ids.buyer = await conta("buyer");
    for (let i = 0; i < 3; i += 1) {
      const { data, error } = await service
        .from("properties")
        .insert({
          owner_id: ids.owner,
          ref: `NAV-${CARIMBO}-${i}`,
          title: `Nav ${i}`,
          deal: "sale",
          status: "active",
          typology: "T1",
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(`Falha a criar imóvel: ${error?.message}`);
      imoveis.push(data.id as string);
    }
  });

  afterAll(async () => {
    if (!service) return;
    await service.from("properties").delete().in("id", imoveis);
    for (const id of [ids.owner, ids.buyer]) if (id) await service.auth.admin.deleteUser(id);
  });

  it("começa a zeros, e o comprador não tem leads", async () => {
    expect(await contadores("owner")).toEqual({ messages: 0, waiting: 0, leads: 0 });
    expect(await contadores("buyer")).toEqual({ messages: 0, waiting: 0, leads: 0 });
  });

  it("soma as mensagens por ler, não as conversas — e o lead nasce da mensagem", async () => {
    const aberta = await sessoes.buyer.rpc("start_conversation", { p_property_id: imoveis[0]! });
    expect(aberta.error).toBeNull();
    const conversa =
      typeof aberta.data === "string" ? aberta.data : (aberta.data as { id: string } | null)?.id;
    expect(conversa).toBeTruthy();
    for (const body of ["Olá", "Ainda está disponível?"]) {
      const { error } = await sessoes.buyer
        .from("messages")
        .insert({ conversation_id: conversa, sender_id: ids.buyer, body });
      expect(error).toBeNull();
    }

    const dono = await contadores("owner");
    expect(dono.messages).toBe(2);
    expect(dono.leads).toBeGreaterThanOrEqual(1);
    // Quem escreveu não tem nada por ler.
    expect((await contadores("buyer")).messages).toBe(0);
  });

  it("a visita que eu propus não conta para mim; a reagendada pelo outro conta", async () => {
    const quando = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const pedida = await sessoes.buyer.rpc("request_visit", {
      p_property_id: imoveis[1]!,
      p_proposed_at: quando,
      p_message: "",
    });
    expect(pedida.error).toBeNull();
    // Pendente, proposta pelo comprador: espera pelo dono, não por ele.
    expect((await contadores("owner")).waiting).toBe(1);
    expect((await contadores("buyer")).waiting).toBe(0);

    const segunda = await sessoes.buyer.rpc("request_visit", {
      p_property_id: imoveis[2]!,
      p_proposed_at: quando,
      p_message: "",
    });
    expect(segunda.error).toBeNull();
    const { data: visitas } = await service
      .from("visit_requests")
      .select("id, property_id")
      .eq("buyer_id", ids.buyer);
    const daSegunda = (visitas ?? []).find((v) => v.property_id === imoveis[2])!.id as string;
    const reagendada = await sessoes.owner.rpc("reschedule_visit_request", {
      p_id: daSegunda,
      p_proposed_at: new Date(Date.now() + 9 * 86_400_000).toISOString(),
    });
    expect(reagendada.error).toBeNull();

    // A reagendada foi o dono a propor: agora espera pelo comprador.
    expect((await contadores("owner")).waiting).toBe(1);
    expect((await contadores("buyer")).waiting).toBe(1);
  });

  it("uma visita aceite já não pede resposta", async () => {
    const { data: visitas } = await service
      .from("visit_requests")
      .select("id, property_id")
      .eq("buyer_id", ids.buyer);
    const daPrimeira = (visitas ?? []).find((v) => v.property_id === imoveis[1])!.id as string;
    const aceite = await sessoes.owner.rpc("accept_visit_request", { p_id: daPrimeira });
    expect(aceite.error).toBeNull();
    expect((await contadores("owner")).waiting).toBe(0);
  });

  it("é a mesma definição que a regra antiga, sobre as mesmas listas", async () => {
    for (const papel of ["owner", "buyer"] as const) {
      expect(await contadores(papel), papel).toEqual(await pelaRegraAntiga(papel));
    }
  });

  it("o anon não lhe chega (A15)", async () => {
    const anon = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } });
    expect((await anon.rpc("my_nav_counters")).error).not.toBeNull();
  });
});
