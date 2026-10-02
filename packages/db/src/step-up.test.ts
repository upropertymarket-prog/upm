/**
 * Step-up do PIN de operação (Fase 8, P8-07)
 * =========================================================================
 * 07 §6 exige PIN antes de cada ação sensível do `interno`, e 07 §21.1 conta
 * porque é que a infraestrutura existia desde a Fase 3 sem nunca ser usada.
 *
 * Estes testes atacam o mecanismo **por RPC direto**, não pela interface — é o
 * único sítio onde se prova o que 08 pede: "nunca confiar apenas na proteção da
 * UI para ações administrativas". Cada caso abaixo é um caminho que, antes
 * desta tarefa, dava step-up sem PIN ou escrevia no `audit_log` em nome de
 * outra pessoa.
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

const PASSWORD = "stepup-rls-test-P@ss1";
const USERS = {
  admin: { email: "stepup-admin@upropertymarket.test", role: "admin" },
  support: { email: "stepup-support@upropertymarket.test", role: "support" },
  owner: { email: "stepup-owner@upropertymarket.test", role: "owner" },
} as const;

type Who = keyof typeof USERS;

describe.skipIf(!hasEnv)("Step-up do PIN (Fase 8, P8-07)", () => {
  let service: SupabaseClient;
  let anon: SupabaseClient;
  const clients = {} as Record<Who, SupabaseClient>;
  const ids = {} as Record<Who, string>;

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

  /** Põe `last_step_up_at` no passado ou no presente, pelo service_role. */
  async function setStepUp(profileId: string, at: Date | null) {
    await service
      .from("staff_auth")
      .upsert(
        { profile_id: profileId, last_step_up_at: at ? at.toISOString() : null },
        { onConflict: "profile_id" },
      );
  }

  beforeAll(async () => {
    service = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);
    anon = createClient(SUPABASE_URL!, ANON_KEY!);

    for (const key of Object.keys(USERS) as Who[]) {
      const { email, role } = USERS[key];
      ids[key] = await user(email, role);
      // O trigger de `auth.users` cria o perfil com o papel dos metadados, mas
      // uma conta reaproveitada de uma corrida anterior pode ter outro.
      await service.from("profiles").update({ role }).eq("id", ids[key]);
      const client = createClient(SUPABASE_URL!, ANON_KEY!);
      const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
      if (error) throw new Error(`Falha a autenticar ${email}: ${error.message}`);
      clients[key] = client;
    }

    await setStepUp(ids.admin, null);
    await setStepUp(ids.support, null);
  });

  afterAll(async () => {
    for (const key of Object.keys(USERS) as Who[]) {
      await service.from("audit_log").delete().eq("actor_id", ids[key]);
      await service.from("staff_auth").delete().eq("profile_id", ids[key]);
    }
  });

  // -------------------------------------------------------------------------
  // O defeito principal: conceder-se step-up sem PIN
  // -------------------------------------------------------------------------

  it("um admin não consegue escrever o seu próprio last_step_up_at", async () => {
    await setStepUp(ids.admin, null);

    const { error } = await clients.admin
      .from("staff_auth")
      .update({ last_step_up_at: new Date().toISOString() })
      .eq("profile_id", ids.admin);

    // Privilégio de coluna revogado: a RLS autorizava a linha, o grant recusa
    // a coluna (07 §20.6 — a RLS não distingue colunas).
    expect(error).not.toBeNull();

    const { data } = await service
      .from("staff_auth")
      .select("last_step_up_at")
      .eq("profile_id", ids.admin)
      .maybeSingle();
    expect(data?.last_step_up_at).toBeNull();
  });

  it("um admin não consegue inserir uma linha de staff_auth já com step-up", async () => {
    await service.from("staff_auth").delete().eq("profile_id", ids.admin);

    const { error } = await clients.admin.from("staff_auth").insert({
      profile_id: ids.admin,
      last_step_up_at: new Date().toISOString(),
    });

    expect(error).not.toBeNull();
    await setStepUp(ids.admin, null);
  });

  it("mark_step_up não é chamável por uma sessão de staff", async () => {
    const { error } = await clients.admin.rpc("mark_step_up", { p_profile_id: ids.admin });
    expect(error).not.toBeNull();
  });

  it("o staff continua a poder definir o seu PIN", async () => {
    const { error } = await clients.admin
      .from("staff_auth")
      .upsert(
        {
          profile_id: ids.admin,
          pin_hash: "$argon2id$v=19$fake",
          pin_updated_at: new Date().toISOString(),
        },
        { onConflict: "profile_id" },
      );
    expect(error).toBeNull();
  });

  // -------------------------------------------------------------------------
  // step_up_valid / require_step_up
  // -------------------------------------------------------------------------

  it("step_up_valid é falso sem step-up, verdadeiro depois, e falso aos 15 min", async () => {
    await setStepUp(ids.admin, null);
    expect((await clients.admin.rpc("step_up_valid")).data).toBe(false);

    await setStepUp(ids.admin, new Date());
    expect((await clients.admin.rpc("step_up_valid")).data).toBe(true);

    // 16 minutos atrás — a janela de 07 §6 são 15.
    await setStepUp(ids.admin, new Date(Date.now() - 16 * 60 * 1000));
    expect((await clients.admin.rpc("step_up_valid")).data).toBe(false);
  });

  it("require_step_up recusa sem step-up e passa com ele", async () => {
    await setStepUp(ids.admin, null);
    const refused = await clients.admin.rpc("require_step_up");
    expect(refused.error).not.toBeNull();
    expect(refused.error?.hint).toBe("step_up_required");

    await setStepUp(ids.admin, new Date());
    expect((await clients.admin.rpc("require_step_up")).error).toBeNull();
  });

  it("anon não chega às funções de step-up", async () => {
    expect((await anon.rpc("step_up_valid")).error).not.toBeNull();
    expect((await anon.rpc("require_step_up")).error).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // Catálogo: editar planos exige PIN (07 §6, correção a P7-05)
  // -------------------------------------------------------------------------

  it("sem step-up, um admin não consegue alterar o preço de um plano", async () => {
    await setStepUp(ids.admin, null);

    const { data: plan } = await service
      .from("plans")
      .select("id, price_month_cents")
      .eq("slug", "smarter-owner")
      .single();

    const { error } = await clients.admin
      .from("plans")
      .update({ price_month_cents: Number(plan!.price_month_cents) + 100 })
      .eq("id", plan!.id);

    expect(error).not.toBeNull();
    expect(error?.hint).toBe("step_up_required");

    const { data: after } = await service
      .from("plans")
      .select("price_month_cents")
      .eq("id", plan!.id)
      .single();
    expect(Number(after!.price_month_cents)).toBe(Number(plan!.price_month_cents));
  });

  it("com step-up, a mesma alteração passa — e o preço volta ao valor original", async () => {
    const { data: plan } = await service
      .from("plans")
      .select("id, price_month_cents")
      .eq("slug", "smarter-owner")
      .single();
    const original = Number(plan!.price_month_cents);

    await setStepUp(ids.admin, new Date());
    const changed = await clients.admin
      .from("plans")
      .update({ price_month_cents: original + 100 })
      .eq("id", plan!.id);
    expect(changed.error).toBeNull();

    const restored = await clients.admin
      .from("plans")
      .update({ price_month_cents: original })
      .eq("id", plan!.id);
    expect(restored.error).toBeNull();
  });

  it("o service_role escreve no catálogo sem step-up — é o caminho da sincronização", async () => {
    const { data: plan } = await service.from("plans").select("id").eq("slug", "gratuito").single();
    const { error } = await service
      .from("plans")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", plan!.id);
    expect(error).toBeNull();
  });

  // -------------------------------------------------------------------------
  // write_audit_log — a porta única (08 §6.7)
  // -------------------------------------------------------------------------

  it("o insert direto em audit_log continua fechado a todos os papéis", async () => {
    for (const who of ["admin", "support", "owner"] as Who[]) {
      const { error } = await clients[who].from("audit_log").insert({
        actor_id: ids[who],
        action: "teste.direto",
        entity: "audit_log",
      });
      expect(error, `${who} conseguiu inserir diretamente`).not.toBeNull();
    }
    expect(
      (await anon.from("audit_log").insert({ action: "x", entity: "y" })).error,
    ).not.toBeNull();
  });

  it("write_audit_log escreve e fixa o actor na sessão", async () => {
    const { data: id, error } = await clients.admin.rpc("write_audit_log", {
      p_action: "teste.step_up",
      p_entity: "staff_auth",
      p_entity_id: ids.admin,
      p_diff: { before: null, after: { ok: true } },
    });

    expect(error).toBeNull();
    const { data: row } = await service
      .from("audit_log")
      .select("actor_id, action, entity")
      .eq("id", id as string)
      .single();
    expect(row!.actor_id).toBe(ids.admin);
    expect(row!.action).toBe("teste.step_up");
  });

  it("write_audit_log não deixa assinar em nome de outro — não há parâmetro para isso", async () => {
    // A assinatura da função não aceita actor; a prova é que o `support` a
    // chama e a linha sai com o id DELE, não com o do admin.
    const { data: id, error } = await clients.support.rpc("write_audit_log", {
      p_action: "teste.actor",
      p_entity: "staff_auth",
    });
    expect(error).toBeNull();

    const { data: row } = await service
      .from("audit_log")
      .select("actor_id")
      .eq("id", id as string)
      .single();
    expect(row!.actor_id).toBe(ids.support);
    expect(row!.actor_id).not.toBe(ids.admin);
  });

  it("write_audit_log recusa quem não é staff", async () => {
    const { error } = await clients.owner.rpc("write_audit_log", {
      p_action: "teste.owner",
      p_entity: "profiles",
    });
    expect(error).not.toBeNull();
  });

  it("write_audit_log recusa action vazia e action demasiado longa", async () => {
    const empty = await clients.admin.rpc("write_audit_log", {
      p_action: "   ",
      p_entity: "plans",
    });
    expect(empty.error).not.toBeNull();

    const long = await clients.admin.rpc("write_audit_log", {
      p_action: "a".repeat(81),
      p_entity: "plans",
    });
    expect(long.error).not.toBeNull();
  });

  it("anon não chama write_audit_log", async () => {
    const { error } = await anon.rpc("write_audit_log", {
      p_action: "teste.anon",
      p_entity: "plans",
    });
    expect(error).not.toBeNull();
  });
});
