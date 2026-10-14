/**
 * Fase 10 · a área do Marketing e as Atualizações (P10-07) — 08 §2.3.
 *
 * As cinco regras que vivem na base de dados, e todas elas de 07 §24.6:
 *
 *  1. **`is_staff()` NÃO inclui o marketing.** É a decisão mais consequente da
 *     secção: `is_staff()` está escrita em políticas de moderação de imóveis,
 *     leads do site, diretório de utilizadores e tickets, e alargá-la dava
 *     tudo isso de uma vez. O teste verifica-o pelas duas pontas — a função e
 *     uma tabela real que ela protege.
 *  2. **`is_internal()` inclui os três**, e só os três.
 *  3. **Um rascunho não é legível por quem não é marketing.** Uma novidade é
 *     muitas vezes o anúncio de algo que ainda não saiu.
 *  4. **A audiência resolve-se no servidor.** `app_updates_for_me()` devolve a
 *     um proprietário o que é para proprietários, e nunca o que é para
 *     compradores.
 *  5. **"Visto" é uma linha, e marcar duas vezes não cria duas.**
 *
 * Salta inteiro sem credenciais de staging (D13) — e, por decisão do cliente,
 * estes testes correm no fim do projeto, não fase a fase.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasEnv = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

const PASSWORD = "phase10-mkt-test-P@ss1";
const USERS = {
  marketing: { email: "phase10-mkt-marketing@upropertymarket.test", role: "marketing" },
  support: { email: "phase10-mkt-support@upropertymarket.test", role: "support" },
  owner: { email: "phase10-mkt-owner@upropertymarket.test", role: "owner" },
  buyer: { email: "phase10-mkt-buyer@upropertymarket.test", role: "buyer" },
} as const;

type Role = keyof typeof USERS | "anon";

const STAMP = Date.now();

describe.skipIf(!hasEnv)("Fase 10 · Marketing: fronteira do papel e Atualizações", () => {
  let service: SupabaseClient;
  const clients = {} as Record<Role, SupabaseClient>;
  const ids = {} as Record<keyof typeof USERS, string>;
  const created: string[] = [];

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

  /** Cria uma atualização já publicada, pelo caminho da service_role. */
  async function publish(audience: "all" | "owners" | "buyers", title: string) {
    const { data, error } = await service
      .from("app_updates")
      .insert({
        title,
        version: "1.0",
        body_html: "<p>Corpo</p>",
        points: ["ponto"],
        audience,
        status: "published",
        published_at: new Date().toISOString(),
        delivery: "next_login",
      })
      .select("id")
      .single();
    if (error) throw new Error(`Falha a publicar ${title}: ${error.message}`);
    created.push(data.id);
    return data.id as string;
  }

  beforeAll(async () => {
    service = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);
    clients.anon = createClient(SUPABASE_URL!, ANON_KEY!);

    for (const role of Object.keys(USERS) as (keyof typeof USERS)[]) {
      const fixture = USERS[role];
      const id = await getOrCreateUser(fixture.email, fixture.role);
      ids[role] = id;

      const { error } = await service
        .from("profiles")
        .update({ role: fixture.role, status: "active" })
        .eq("id", id);
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
    for (const id of created) await service.from("app_updates").delete().eq("id", id);
  });

  // -------------------------------------------------------------------------
  // 1 e 2 — a fronteira do papel
  // -------------------------------------------------------------------------

  it("is_staff() NÃO inclui o marketing, e is_marketing() não inclui o suporte", async () => {
    const staff = await clients.marketing.rpc("is_staff");
    expect(staff.data).toBe(false);

    const marketing = await clients.marketing.rpc("is_marketing");
    expect(marketing.data).toBe(true);

    const supportIsMarketing = await clients.support.rpc("is_marketing");
    expect(supportIsMarketing.data).toBe(false);
  });

  it("is_internal() inclui os três papéis internos, e só esses", async () => {
    for (const role of ["marketing", "support"] as const) {
      const { data } = await clients[role].rpc("is_internal");
      expect(data).toBe(true);
    }
    for (const role of ["owner", "buyer"] as const) {
      const { data } = await clients[role].rpc("is_internal");
      expect(data).toBe(false);
    }
  });

  it("o marketing não vê o que `is_staff()` protege — tickets", async () => {
    // A prova pela ponta prática: não basta a função devolver `false`, tem de
    // haver uma tabela real que continue fechada.
    const { data } = await clients.marketing.from("tickets").select("id").limit(1);
    expect(data ?? []).toHaveLength(0);
  });

  it("o marketing não vê o correio do Suporte", async () => {
    const { data } = await clients.marketing.from("mail_messages").select("id").limit(1);
    expect(data ?? []).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // 3 — rascunhos
  // -------------------------------------------------------------------------

  it("um rascunho só é legível pelo marketing", async () => {
    const { data: draft } = await service
      .from("app_updates")
      .insert({ title: `Rascunho ${STAMP}`, body_html: "<p>segredo</p>" })
      .select("id")
      .single();
    created.push(draft!.id);

    for (const role of ["buyer", "owner", "support", "anon"] as const) {
      const { data } = await clients[role].from("app_updates").select("id").eq("id", draft!.id);
      expect(data ?? [], `${role} não devia ver o rascunho`).toHaveLength(0);
    }

    const { data: seen } = await clients.marketing
      .from("app_updates")
      .select("id")
      .eq("id", draft!.id);
    expect(seen ?? []).toHaveLength(1);
  });

  it("escrever em app_updates é por função — nem o marketing insere direto", async () => {
    const { error } = await clients.marketing
      .from("app_updates")
      .insert({ title: `Direta ${STAMP}` });
    expect(error).not.toBeNull();
  });

  it("o Suporte não escreve atualizações — saíram do Suporte a 13 out 2026", async () => {
    const { error } = await clients.support.rpc("app_update_save", {
      p_id: null,
      p_version: "",
      p_title: `Do suporte ${STAMP}`,
      p_body_html: "<p>a</p>",
      p_points: [],
      p_image_path: null,
      p_image_alt: "",
      p_audience: "all",
      p_delivery: "next_login",
      p_scheduled_for: null,
    });
    expect(error).not.toBeNull();
  });

  it("recusa HTML inseguro — é a prova de que a sanitização correu", async () => {
    const { error } = await clients.marketing.rpc("app_update_save", {
      p_id: null,
      p_version: "",
      p_title: `Insegura ${STAMP}`,
      p_body_html: "<p>a</p><script>alert(1)</script>",
      p_points: [],
      p_image_path: null,
      p_image_alt: "",
      p_audience: "all",
      p_delivery: "next_login",
      p_scheduled_for: null,
    });
    expect(error).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // 4 — a audiência resolve-se no servidor
  // -------------------------------------------------------------------------

  it("cada público recebe o que é dele, e nunca o do outro", async () => {
    const forOwners = await publish("owners", `Proprietários ${STAMP}`);
    const forBuyers = await publish("buyers", `Compradores ${STAMP}`);
    const forAll = await publish("all", `Todos ${STAMP}`);

    const owner = await clients.owner.rpc("app_updates_for_me");
    const ownerIds = (owner.data ?? []).map((row: { id: string }) => row.id);
    expect(ownerIds).toContain(forOwners);
    expect(ownerIds).toContain(forAll);
    expect(ownerIds).not.toContain(forBuyers);

    const buyer = await clients.buyer.rpc("app_updates_for_me");
    const buyerIds = (buyer.data ?? []).map((row: { id: string }) => row.id);
    expect(buyerIds).toContain(forBuyers);
    expect(buyerIds).not.toContain(forOwners);
  });

  it("a equipa interna não recebe novidades — foi ela que as escreveu", async () => {
    for (const role of ["marketing", "support"] as const) {
      const { data } = await clients[role].rpc("app_updates_for_me");
      expect(data ?? []).toHaveLength(0);
    }
  });

  // -------------------------------------------------------------------------
  // 5 — "visto" é uma linha
  // -------------------------------------------------------------------------

  it("marcar como vista tira-a da fila, e marcar duas vezes não dá erro", async () => {
    const update = await publish("all", `Vista ${STAMP}`);

    const first = await clients.buyer.rpc("mark_app_update_seen", { p_update_id: update });
    expect(first.error).toBeNull();
    const again = await clients.buyer.rpc("mark_app_update_seen", { p_update_id: update });
    expect(again.error).toBeNull();

    const { data: rows } = await service
      .from("app_update_views")
      .select("id")
      .eq("update_id", update)
      .eq("profile_id", ids.buyer);
    expect(rows ?? []).toHaveLength(1);

    const { data: queue } = await clients.buyer.rpc("app_updates_for_me");
    expect((queue ?? []).map((row: { id: string }) => row.id)).not.toContain(update);
  });

  it("não se marca como vista uma que não está publicada", async () => {
    const { data: draft } = await service
      .from("app_updates")
      .insert({ title: `Por publicar ${STAMP}` })
      .select("id")
      .single();
    created.push(draft!.id);

    const { error } = await clients.buyer.rpc("mark_app_update_seen", {
      p_update_id: draft!.id,
    });
    expect(error).not.toBeNull();
  });

  it("ninguém marca uma leitura em nome de outra pessoa", async () => {
    const update = await publish("all", `De outro ${STAMP}`);
    const { error } = await clients.buyer
      .from("app_update_views")
      .insert({ update_id: update, profile_id: ids.owner });
    expect(error).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // O ciclo de vida
  // -------------------------------------------------------------------------

  it("uma publicada não se edita nem se apaga — arquiva-se", async () => {
    const update = await publish("all", `Publicada ${STAMP}`);

    const edit = await clients.marketing.rpc("app_update_save", {
      p_id: update,
      p_version: "2.0",
      p_title: "Outro título",
      p_body_html: "<p>outro</p>",
      p_points: [],
      p_image_path: null,
      p_image_alt: "",
      p_audience: "all",
      p_delivery: "next_login",
      p_scheduled_for: null,
    });
    expect(edit.error).not.toBeNull();

    const remove = await clients.marketing.rpc("app_update_delete", { p_id: update });
    expect(remove.error).not.toBeNull();

    const archive = await clients.marketing.rpc("app_update_archive", { p_id: update });
    expect(archive.error).toBeNull();

    // Arquivada deixa de ser entregue, mas as leituras que houve ficam.
    const { data: queue } = await clients.owner.rpc("app_updates_for_me");
    expect((queue ?? []).map((row: { id: string }) => row.id)).not.toContain(update);
  });

  it("uma data de agendamento põe a atualização em Agendada", async () => {
    const soon = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { data: id } = await clients.marketing.rpc("app_update_save", {
      p_id: null,
      p_version: "",
      p_title: `Agendada ${STAMP}`,
      p_body_html: "<p>a</p>",
      p_points: [],
      p_image_path: null,
      p_image_alt: "",
      p_audience: "all",
      p_delivery: "banner",
      p_scheduled_for: soon,
    });
    created.push(id as string);

    // Nasce rascunho e o `update` seguinte é que a agenda — é o que a função
    // faz, e o teste fixa-o para ninguém o inverter sem perceber.
    const second = await clients.marketing.rpc("app_update_save", {
      p_id: id as string,
      p_version: "",
      p_title: `Agendada ${STAMP}`,
      p_body_html: "<p>a</p>",
      p_points: [],
      p_image_path: null,
      p_image_alt: "",
      p_audience: "all",
      p_delivery: "banner",
      p_scheduled_for: soon,
    });
    expect(second.error).toBeNull();

    const { data: row } = await service
      .from("app_updates")
      .select("status, scheduled_for")
      .eq("id", id as string)
      .single();
    expect(row?.status).toBe("scheduled");
    expect(row?.scheduled_for).not.toBeNull();
  });

  it("a passagem do agendador é só da service_role", async () => {
    for (const role of ["marketing", "buyer"] as const) {
      const { error } = await clients[role].rpc("publish_due_app_updates");
      expect(error).not.toBeNull();
    }
  });
});
