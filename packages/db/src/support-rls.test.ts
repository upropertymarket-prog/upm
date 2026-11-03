/**
 * Fase 10 · Parte 1 — tickets de suporte (08 §2.3).
 *
 * Uma linha da matriz de acesso por cada tabela nova — `tickets` e
 * `ticket_events` — mais as regras que a migração `20261007130000` põe na base
 * de dados e que nenhum teste de aplicação apanharia: o dedupe por
 * `fingerprint`, a fusão `report` + `auto` em `both`, a reabertura de um ticket
 * fechado, e o Admin a não poder escrever.
 *
 * Os fixtures nascem com `service_role`; as tentativas são feitas com sessões
 * `anon`, `buyer`, `support` e `admin`. Como em `phase9-rls.test.ts`, o teste
 * salta inteiro quando faltam credenciais de staging (D13) — e, por decisão do
 * cliente, estes testes correm no fim do projeto, não fase a fase.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listarTodosOsUtilizadores } from "./test-users";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasEnv = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

const PASSWORD = "phase10-rls-test-P@ss1";
const USERS = {
  admin: { email: "phase10-admin@upropertymarket.test", role: "admin" },
  support: { email: "phase10-support@upropertymarket.test", role: "support" },
  buyer: { email: "phase10-buyer@upropertymarket.test", role: "buyer" },
  other: { email: "phase10-other@upropertymarket.test", role: "buyer" },
} as const;

type Role = keyof typeof USERS | "anon";

/** Prefixo próprio, para a limpeza não tocar em tickets reais de staging. */
const FP = `test:phase10:${Date.now()}`;

describe.skipIf(!hasEnv)("Fase 10 · Parte 1 — tickets: matriz RLS e regras", () => {
  let service: SupabaseClient;
  const clients = {} as Record<Role, SupabaseClient>;
  const ids = {} as Record<keyof typeof USERS, string>;

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
    if (createError || !data.user) {
      throw new Error(`Falha a criar ${email}: ${createError?.message}`);
    }
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
  });

  afterAll(async () => {
    if (!service) return;
    // `ticket_events` cai por `on delete cascade`.
    await service.from("tickets").delete().like("fingerprint", `${FP}%`);
  });

  // -------------------------------------------------------------------------
  // Entrada: report_problem é a única porta
  // -------------------------------------------------------------------------

  it("recusa um insert direto em tickets, mesmo autenticado", async () => {
    // Não há policy de insert: o `fingerprint`, a gravidade e o `reporter_id`
    // não podem ser escolhidos pelo cliente.
    const { error } = await clients.buyer.from("tickets").insert({
      title: "Insert direto",
      fingerprint: `${FP}:direct`,
    });
    expect(error).not.toBeNull();
  });

  it("recusa report_problem sem sessão", async () => {
    const { error } = await clients.anon.rpc("report_problem", {
      p_fingerprint: `${FP}:anon`,
      p_title: "Sem sessão",
    });
    expect(error).not.toBeNull();
  });

  it("cria o ticket com referência XXXX-XXXX e gravidade sugerida", async () => {
    const { data, error } = await clients.buyer.rpc("report_problem", {
      p_fingerprint: `${FP}:create`,
      p_title: "O anúncio não aparece",
      p_description: "Cliquei em Publicar e nada aconteceu.",
      p_route: "/propriedades",
    });
    expect(error).toBeNull();
    const row = data?.[0];
    expect(row?.ref).toMatch(
      /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/,
    );
    expect(row?.merged).toBe(false);
    // `/propriedades` não é pagamento nem dado pessoal, e é um relato só.
    expect(row?.severity).toBe("medium");
  });

  it("sugere crítico numa rota de pagamento à primeira pessoa", async () => {
    const { data } = await clients.buyer.rpc("report_problem", {
      p_fingerprint: `${FP}:payments`,
      p_title: "Não consigo pagar",
      p_route: "/plano?checkout=1",
    });
    expect(data?.[0]?.severity).toBe("critical");
  });

  it("sugere crítico onde se tratam dados pessoais", async () => {
    const { data } = await service.rpc("suggest_ticket_severity", {
      p_route: "/definicoes",
      p_affected_users: 1,
    });
    expect(data).toBe("critical");
  });

  it("sobe a crítico ao atingir o limiar de app_settings", async () => {
    const { data: below } = await service.rpc("suggest_ticket_severity", {
      p_route: "/market",
      p_affected_users: 4,
    });
    expect(below).toBe("medium");

    const { data: at } = await service.rpc("suggest_ticket_severity", {
      p_route: "/market",
      p_affected_users: 5,
    });
    expect(at).toBe("critical");
  });

  // -------------------------------------------------------------------------
  // Dedupe e fusão (04 §2.7 #3)
  // -------------------------------------------------------------------------

  it("funde o mesmo fingerprint em vez de criar um segundo ticket", async () => {
    const fingerprint = `${FP}:dedupe`;
    const first = await clients.buyer.rpc("report_problem", {
      p_fingerprint: fingerprint,
      p_title: "Erro no mapa",
    });
    const second = await clients.other.rpc("report_problem", {
      p_fingerprint: fingerprint,
      p_title: "O mapa não abre",
    });

    expect(first.data?.[0]?.merged).toBe(false);
    expect(second.data?.[0]?.merged).toBe(true);
    expect(second.data?.[0]?.id).toBe(first.data?.[0]?.id);

    const { data: ticket } = await service
      .from("tickets")
      .select("occurrences, affected_users")
      .eq("fingerprint", fingerprint)
      .single();
    expect(ticket?.occurrences).toBe(2);
    // Pessoas diferentes ⇒ duas afetadas.
    expect(ticket?.affected_users).toBe(2);
  });

  it("não conta duas vezes a mesma pessoa em affected_users", async () => {
    const fingerprint = `${FP}:same-person`;
    await clients.buyer.rpc("report_problem", { p_fingerprint: fingerprint, p_title: "Uma vez" });
    await clients.buyer.rpc("report_problem", { p_fingerprint: fingerprint, p_title: "Outra vez" });

    const { data: ticket } = await service
      .from("tickets")
      .select("occurrences, affected_users")
      .eq("fingerprint", fingerprint)
      .single();
    expect(ticket?.occurrences).toBe(2);
    expect(ticket?.affected_users).toBe(1);
  });

  it("passa a origin=both quando um relato manual encontra um automático", async () => {
    const fingerprint = `${FP}:both`;
    await clients.buyer.rpc("report_problem", {
      p_fingerprint: fingerprint,
      p_title: "Rebentou",
      p_origin: "auto",
    });
    await clients.other.rpc("report_problem", {
      p_fingerprint: fingerprint,
      p_title: "Não funciona",
      p_origin: "report",
    });

    const { data: ticket } = await service
      .from("tickets")
      .select("origin")
      .eq("fingerprint", fingerprint)
      .single();
    expect(ticket?.origin).toBe("both");
  });

  // -------------------------------------------------------------------------
  // Workflow: só o Suporte (07 §5.10)
  // -------------------------------------------------------------------------

  it("o Admin NÃO pode mudar o estado de um ticket", async () => {
    const { data } = await clients.buyer.rpc("report_problem", {
      p_fingerprint: `${FP}:admin-write`,
      p_title: "Para o admin tentar",
    });
    const ticketId = data?.[0]?.id as string;

    const { error } = await clients.admin.rpc("set_ticket_status", {
      p_ticket_id: ticketId,
      p_status: "in_progress",
    });
    expect(error).not.toBeNull();
    expect(error?.hint).toBe("not_support");

    // E o update direto também não passa pela policy.
    const direct = await clients.admin
      .from("tickets")
      .update({ status: "in_progress" })
      .eq("id", ticketId);
    expect(direct.error ?? { code: "0" }).toBeTruthy();

    const { data: unchanged } = await service
      .from("tickets")
      .select("status")
      .eq("id", ticketId)
      .single();
    expect(unchanged?.status).toBe("new");
  });

  it("quem reportou não pode mudar o estado do seu próprio ticket", async () => {
    const { data } = await clients.buyer.rpc("report_problem", {
      p_fingerprint: `${FP}:self-write`,
      p_title: "Para o reporter tentar",
    });
    const { error } = await clients.buyer.rpc("set_ticket_status", {
      p_ticket_id: data?.[0]?.id as string,
      p_status: "closed",
      p_fix_note: "Resolvido por mim.",
    });
    expect(error?.hint).toBe("not_support");
  });

  it("o Suporte muda o estado e cada mudança fica em ticket_events", async () => {
    const { data } = await clients.buyer.rpc("report_problem", {
      p_fingerprint: `${FP}:workflow`,
      p_title: "Fluxo completo",
    });
    const ticketId = data?.[0]?.id as string;

    for (const status of ["triage", "in_progress", "awaiting_confirmation"] as const) {
      const { error } = await clients.support.rpc("set_ticket_status", {
        p_ticket_id: ticketId,
        p_status: status,
      });
      expect(error).toBeNull();
    }

    const { data: events } = await service
      .from("ticket_events")
      .select("status_to")
      .eq("ticket_id", ticketId)
      .order("occurred_at");
    // "Recebido" + três mudanças.
    expect(events?.map((e) => e.status_to)).toEqual([
      "new",
      "triage",
      "in_progress",
      "awaiting_confirmation",
    ]);
  });

  it("recusa fechar sem dizer o que foi corrigido", async () => {
    const { data } = await clients.buyer.rpc("report_problem", {
      p_fingerprint: `${FP}:close-empty`,
      p_title: "Fechar sem nota",
    });
    const ticketId = data?.[0]?.id as string;

    const { error } = await clients.support.rpc("set_ticket_status", {
      p_ticket_id: ticketId,
      p_status: "closed",
    });
    expect(error?.hint).toBe("fix_note_required");

    const { error: ok } = await clients.support.rpc("set_ticket_status", {
      p_ticket_id: ticketId,
      p_status: "closed",
      p_fix_note: "Corrigido o cálculo da data.",
    });
    expect(ok).toBeNull();
  });

  it("reabre em new e limpa a nota quando um ticket fechado volta a acontecer", async () => {
    const fingerprint = `${FP}:reopen`;
    const { data } = await clients.buyer.rpc("report_problem", {
      p_fingerprint: fingerprint,
      p_title: "Vai e volta",
    });
    const ticketId = data?.[0]?.id as string;

    await clients.support.rpc("set_ticket_status", {
      p_ticket_id: ticketId,
      p_status: "closed",
      p_fix_note: "Corrigido.",
    });

    await clients.other.rpc("report_problem", {
      p_fingerprint: fingerprint,
      p_title: "Voltou a acontecer",
    });

    const { data: reopened } = await service
      .from("tickets")
      .select("status, fix_note")
      .eq("id", ticketId)
      .single();
    expect(reopened?.status).toBe("new");
    // A nota de correção deixou de ser verdadeira.
    expect(reopened?.fix_note).toBeNull();

    const { data: events } = await service
      .from("ticket_events")
      .select("status_from, status_to, note")
      .eq("ticket_id", ticketId)
      .order("occurred_at");
    const last = events?.at(-1);
    expect(last?.status_from).toBe("closed");
    expect(last?.status_to).toBe("new");
  });

  it("não escreve evento de reabertura num ticket que nunca fechou", async () => {
    const fingerprint = `${FP}:no-false-reopen`;
    await clients.buyer.rpc("report_problem", { p_fingerprint: fingerprint, p_title: "Uma" });
    await clients.other.rpc("report_problem", { p_fingerprint: fingerprint, p_title: "Duas" });
    await clients.buyer.rpc("report_problem", { p_fingerprint: fingerprint, p_title: "Três" });

    const { data: ticket } = await service
      .from("tickets")
      .select("id")
      .eq("fingerprint", fingerprint)
      .single();
    const { data: events } = await service
      .from("ticket_events")
      .select("status_to")
      .eq("ticket_id", ticket!.id);
    // Só o "Recebido": três ocorrências não são três eventos.
    expect(events).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // Leitura: a matriz de acesso
  // -------------------------------------------------------------------------

  it("cada pessoa lê o seu ticket e não o de outra", async () => {
    const mine = await clients.buyer.rpc("report_problem", {
      p_fingerprint: `${FP}:mine`,
      p_title: "O meu",
    });
    const theirs = await clients.other.rpc("report_problem", {
      p_fingerprint: `${FP}:theirs`,
      p_title: "O dela",
    });

    const { data: own } = await clients.buyer
      .from("tickets")
      .select("id")
      .eq("id", mine.data?.[0]?.id as string)
      .maybeSingle();
    expect(own).not.toBeNull();

    const { data: foreign } = await clients.buyer
      .from("tickets")
      .select("id")
      .eq("id", theirs.data?.[0]?.id as string)
      .maybeSingle();
    expect(foreign).toBeNull();
  });

  it("o staff lê todos os tickets e o anónimo não lê nenhum", async () => {
    await clients.buyer.rpc("report_problem", {
      p_fingerprint: `${FP}:staff-read`,
      p_title: "Para o staff ler",
    });

    for (const role of ["support", "admin"] as const) {
      const { data } = await clients[role]
        .from("tickets")
        .select("id")
        .like("fingerprint", `${FP}%`);
      expect((data ?? []).length).toBeGreaterThan(0);
    }

    const { data: anonRows } = await clients.anon
      .from("tickets")
      .select("id")
      .like("fingerprint", `${FP}%`);
    expect(anonRows ?? []).toHaveLength(0);
  });

  it("os eventos seguem a visibilidade do ticket", async () => {
    const mine = await clients.buyer.rpc("report_problem", {
      p_fingerprint: `${FP}:events-read`,
      p_title: "Eventos",
    });
    const ticketId = mine.data?.[0]?.id as string;

    const { data: own } = await clients.buyer
      .from("ticket_events")
      .select("id")
      .eq("ticket_id", ticketId);
    expect((own ?? []).length).toBeGreaterThan(0);

    const { data: foreign } = await clients.other
      .from("ticket_events")
      .select("id")
      .eq("ticket_id", ticketId);
    expect(foreign ?? []).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // D48 — o KPI do Painel do Admin
  // -------------------------------------------------------------------------

  it("open_bugs_count conta os abertos para o staff e devolve zero a quem não é", async () => {
    await clients.buyer.rpc("report_problem", {
      p_fingerprint: `${FP}:kpi`,
      p_title: "Para contar",
    });

    const { data: staffCount } = await clients.admin.rpc("open_bugs_count");
    expect(typeof staffCount).toBe("number");
    expect(staffCount as number).toBeGreaterThan(0);

    const { data: buyerCount } = await clients.buyer.rpc("open_bugs_count");
    expect(buyerCount).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Retenção de 90 dias — as gravações, não os tickets
  // -------------------------------------------------------------------------

  it("a purga limpa as últimas ações e mantém o ticket", async () => {
    const fingerprint = `${FP}:purge`;
    const { data } = await clients.buyer.rpc("report_problem", {
      p_fingerprint: fingerprint,
      p_title: "Antigo",
      p_breadcrumbs: [{ at: "2026-01-01T00:00:00Z", kind: "click", label: "Guardar" }],
      p_console_errors: ["TypeError: x is not a function"],
      p_session_id: "sess-123",
    });
    const ticketId = data?.[0]?.id as string;

    // Envelhecer o ticket com `service_role`, que não passa por RLS.
    await service
      .from("tickets")
      .update({ last_seen_at: "2026-01-01T00:00:00Z" })
      .eq("id", ticketId);

    const { error } = await service.rpc("purge_ticket_technical_data");
    // A função é `revoke`-ada de `public`; com `service_role` corre.
    expect(error).toBeNull();

    const { data: purged } = await service
      .from("tickets")
      .select("title, breadcrumbs, console_errors, session_id, technical_purged_at")
      .eq("id", ticketId)
      .single();

    expect(purged?.title).toBe("Antigo");
    expect(purged?.breadcrumbs).toBeNull();
    expect(purged?.console_errors).toBeNull();
    expect(purged?.session_id).toBeNull();
    // A marca distingue "retenção cumprida" de "captura falhada".
    expect(purged?.technical_purged_at).not.toBeNull();
  });
});

/**
 * P10-02 — as leituras por papel e a notificação ao reporter.
 *
 * Separado do bloco acima por ser outra tarefa, e com fixtures próprios: o
 * `FP` daquele bloco é limpo no seu `afterAll`.
 */
describe.skipIf(!hasEnv)("Fase 10 · Parte 1 — leituras e notificação (P10-02)", () => {
  let service: SupabaseClient;
  const clients = {} as Record<Role, SupabaseClient>;
  const ids = {} as Record<keyof typeof USERS, string>;
  const FP2 = `test:phase10b:${Date.now()}`;

  beforeAll(async () => {
    service = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);
    clients.anon = createClient(SUPABASE_URL!, ANON_KEY!);

    const { data: users } = await listarTodosOsUtilizadores(service);
    for (const role of Object.keys(USERS) as (keyof typeof USERS)[]) {
      const fixture = USERS[role];
      const found = users?.users.find((user) => user.email === fixture.email);
      if (!found) throw new Error(`Fixture ${fixture.email} não existe — corra o bloco anterior.`);
      ids[role] = found.id;
      const client = createClient(SUPABASE_URL!, ANON_KEY!);
      await client.auth.signInWithPassword({ email: fixture.email, password: PASSWORD });
      clients[role] = client;
    }
  });

  afterAll(async () => {
    if (!service) return;
    await service
      .from("notifications")
      .delete()
      .eq("profile_id", ids.buyer)
      .eq("type", "ticket_update");
    await service.from("tickets").delete().like("fingerprint", `${FP2}%`);
  });

  it("support_list_tickets recusa quem não é staff", async () => {
    const { error } = await clients.buyer.rpc("support_list_tickets", { p_tab: "pending" });
    expect(error?.hint).toBe("not_staff");
  });

  it("support_ticket_detail recusa quem reportou — os factos técnicos são do staff", async () => {
    const { data } = await clients.buyer.rpc("report_problem", {
      p_fingerprint: `${FP2}:detail`,
      p_title: "Detalhe técnico",
    });
    const { error } = await clients.buyer.rpc("support_ticket_detail", {
      p_ticket_id: data?.[0]?.id as string,
    });
    expect(error?.hint).toBe("not_staff");
  });

  it("my_reports devolve só os do titular e nenhuma coluna técnica", async () => {
    await clients.buyer.rpc("report_problem", {
      p_fingerprint: `${FP2}:mine`,
      p_title: "O meu relato",
      p_breadcrumbs: [{ at: "2026-10-07T00:00:00Z", kind: "click", label: "Guardar" }],
      p_console_errors: ["TypeError"],
    });
    await clients.other.rpc("report_problem", {
      p_fingerprint: `${FP2}:theirs`,
      p_title: "O relato dela",
    });

    const { data: mine } = await clients.buyer.rpc("my_reports");
    const titles = (mine ?? []).map((row: { title: string }) => row.title);
    expect(titles).toContain("O meu relato");
    expect(titles).not.toContain("O relato dela");

    // A garantia está no contrato da função, não no `select` de um ecrã.
    const row = (mine ?? [])[0] as Record<string, unknown> | undefined;
    for (const forbidden of [
      "breadcrumbs",
      "console_errors",
      "session_id",
      "fingerprint",
      "affected_users",
      "route",
    ]) {
      expect(row && forbidden in row).toBeFalsy();
    }
  });

  it("ticket_history esconde o nome de quem mexeu, a quem reportou", async () => {
    const { data } = await clients.buyer.rpc("report_problem", {
      p_fingerprint: `${FP2}:history`,
      p_title: "Histórico",
    });
    const ticketId = data?.[0]?.id as string;
    await clients.support.rpc("set_ticket_status", {
      p_ticket_id: ticketId,
      p_status: "in_progress",
    });

    const { data: forReporter } = await clients.buyer.rpc("ticket_history", {
      p_ticket_id: ticketId,
    });
    expect(
      (forReporter ?? []).every(
        (event: { actor_name: string | null }) => event.actor_name === null,
      ),
    ).toBe(true);

    const { data: forStaff } = await clients.support.rpc("ticket_history", {
      p_ticket_id: ticketId,
    });
    expect(
      (forStaff ?? []).some((event: { actor_name: string | null }) => Boolean(event.actor_name)),
    ).toBe(true);

    // Quem não é nem uma coisa nem outra não lê nada.
    const { error } = await clients.other.rpc("ticket_history", { p_ticket_id: ticketId });
    expect(error?.hint).toBe("not_allowed");
  });

  it("notifica quem reportou a cada mudança de estado, e não a si próprio", async () => {
    const { data } = await clients.buyer.rpc("report_problem", {
      p_fingerprint: `${FP2}:notify`,
      p_title: "Para notificar",
    });
    const ticketId = data?.[0]?.id as string;

    await clients.support.rpc("set_ticket_status", {
      p_ticket_id: ticketId,
      p_status: "in_progress",
    });

    const { data: notifications } = await service
      .from("notifications")
      .select("type, link, title")
      .eq("profile_id", ids.buyer)
      .eq("type", "ticket_update")
      .order("created_at", { ascending: false })
      .limit(1);

    const notification = notifications?.[0];
    expect(notification).toBeTruthy();
    // A rota é `/reports` — `/meus-reports` era o 404 que `20261007140100` corrigiu.
    expect(notification?.link).toBe(`/reports?ticket=${ticketId}`);

    // Guardar o MESMO estado outra vez não é um passo novo: não notifica.
    const before = (
      await service
        .from("notifications")
        .select("id")
        .eq("profile_id", ids.buyer)
        .eq("type", "ticket_update")
    ).data?.length;
    await clients.support.rpc("set_ticket_status", {
      p_ticket_id: ticketId,
      p_status: "in_progress",
      p_fix_note: "A acrescentar uma nota, sem mudar o estado.",
    });
    const after = (
      await service
        .from("notifications")
        .select("id")
        .eq("profile_id", ids.buyer)
        .eq("type", "ticket_update")
    ).data?.length;
    expect(after).toBe(before);
  });

  it("admin_dashboard_metrics inclui open_bugs — fecha D48", async () => {
    await clients.buyer.rpc("report_problem", {
      p_fingerprint: `${FP2}:kpi`,
      p_title: "Para o KPI",
    });
    const { data } = await clients.admin.rpc("admin_dashboard_metrics");
    const summary = (data as { summary?: Record<string, number> } | null)?.summary;
    expect(summary).toBeTruthy();
    expect(typeof summary?.open_bugs).toBe("number");
    expect(summary?.open_bugs as number).toBeGreaterThan(0);
  });
});
