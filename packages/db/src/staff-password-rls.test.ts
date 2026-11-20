/**
 * A palavra-passe da equipa é da administração (20 nov 2026)
 * =========================================================================
 * Decisão do cliente: ninguém da equipa define nem recupera a própria
 * palavra-passe — muda-a um admin, e a de um admin muda-a o outro. A regra
 * vive na base (migração 20261120130000): `admin_set_staff_password` e um
 * gatilho em `auth.users` que recusa qualquer outra mudança.
 *
 * Por isso estes testes atacam pelo próprio Supabase Auth (`updateUser`), pela
 * API de administração com a chave de serviço e por RPC direto — os caminhos
 * que o interno já não usa, mas que continuam abertos a quem tenha uma sessão
 * ou a chave.
 *
 * Precisa de NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e
 * SUPABASE_SERVICE_ROLE_KEY no ambiente — sem eles salta, como os restantes
 * testes de RLS.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasEnv = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

const PASSWORD = "staffpw-rls-test-P@ss1";
const NEW_PASSWORD = "staffpw-rls-nova-P@ss2";
const RUN_ID = crypto.randomUUID().replaceAll("-", "");
const USERS = {
  admin: { email: `staffpw-${RUN_ID}-admin@upropertymarket.test`, role: "admin" },
  admin2: { email: `staffpw-${RUN_ID}-admin2@upropertymarket.test`, role: "admin" },
  support: { email: `staffpw-${RUN_ID}-support@upropertymarket.test`, role: "support" },
  owner: { email: `staffpw-${RUN_ID}-owner@upropertymarket.test`, role: "owner" },
} as const;

type Who = keyof typeof USERS;

describe.skipIf(!hasEnv)("A palavra-passe da equipa é da administração", () => {
  let service: SupabaseClient;
  let anon: SupabaseClient;
  const clients = {} as Record<Who, SupabaseClient>;
  const ids = {} as Record<Who, string>;

  const newClient = () =>
    createClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } });

  async function signIn(email: string, password: string) {
    const client = newClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    return { client, error };
  }

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
    anon = newClient();

    for (const key of Object.keys(USERS) as Who[]) {
      const { email, role } = USERS[key];
      const created = await service.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { role },
      });
      if (created.error || !created.data.user) {
        throw new Error(`Falha a criar ${email}: ${created.error?.message}`);
      }
      ids[key] = created.data.user.id;
      await service.from("profiles").update({ role, status: "active" }).eq("id", ids[key]);
      const { client, error } = await signIn(email, PASSWORD);
      if (error) throw new Error(`Falha a autenticar ${email}: ${error.message}`);
      clients[key] = client;
    }
  });

  afterAll(async () => {
    for (const key of Object.keys(USERS) as Who[]) {
      if (!ids[key]) continue;
      await service.from("staff_auth").delete().eq("profile_id", ids[key]);
      await service.auth.admin.deleteUser(ids[key]);
    }
  });

  it("ninguém da equipa muda a própria pelo Supabase Auth", async () => {
    for (const who of ["support", "admin"] as Who[]) {
      const { error } = await clients[who].auth.updateUser({ password: NEW_PASSWORD });
      expect(error, who).not.toBeNull();
      expect((await signIn(USERS[who].email, PASSWORD)).error, who).toBeNull();
    }
  });

  it("nem a chave de serviço muda a de alguém da equipa por fora da função", async () => {
    const { error } = await service.auth.admin.updateUserById(ids.support, {
      password: NEW_PASSWORD,
    });
    expect(error).not.toBeNull();
    expect((await signIn(USERS.support.email, PASSWORD)).error).toBeNull();
  });

  it("um cliente continua a mudar a sua", async () => {
    const { error } = await clients.owner.auth.updateUser({ password: NEW_PASSWORD });
    expect(error).toBeNull();
    expect((await signIn(USERS.owner.email, NEW_PASSWORD)).error).toBeNull();
  });

  it("sem o PIN, o admin não muda a de ninguém", async () => {
    await setStepUp(ids.admin, null);
    const { error } = await clients.admin.rpc("admin_set_staff_password", {
      p_profile_id: ids.support,
      p_password: NEW_PASSWORD,
    });
    expect(error?.hint).toBe("step_up_required");
  });

  it("com o PIN, o admin não muda a própria, nem a de um cliente, nem uma curta", async () => {
    await setStepUp(ids.admin, new Date());
    for (const [alvo, palavraPasse] of [
      [ids.admin, NEW_PASSWORD],
      [ids.owner, NEW_PASSWORD],
      [ids.support, "curta"],
    ] as const) {
      const { error } = await clients.admin.rpc("admin_set_staff_password", {
        p_profile_id: alvo,
        p_password: palavraPasse,
      });
      expect(error).not.toBeNull();
    }
  });

  it("quem não é admin não chama a função — nem o suporte com PIN, nem o anon", async () => {
    await setStepUp(ids.support, new Date());
    const suporte = await clients.support.rpc("admin_set_staff_password", {
      p_profile_id: ids.admin,
      p_password: NEW_PASSWORD,
    });
    expect(suporte.error).not.toBeNull();
    const semConta = await anon.rpc("admin_set_staff_password", {
      p_profile_id: ids.admin,
      p_password: NEW_PASSWORD,
    });
    expect(semConta.error).not.toBeNull();
    expect((await signIn(USERS.admin.email, PASSWORD)).error).toBeNull();
  });

  it("o admin muda a do suporte: a antiga deixa de servir e a sessão aberta cai", async () => {
    await setStepUp(ids.admin, new Date());
    const { error } = await clients.admin.rpc("admin_set_staff_password", {
      p_profile_id: ids.support,
      p_password: NEW_PASSWORD,
    });
    expect(error).toBeNull();

    expect((await signIn(USERS.support.email, PASSWORD)).error).not.toBeNull();
    expect((await signIn(USERS.support.email, NEW_PASSWORD)).error).toBeNull();
    // A sessão que o suporte tinha aberta foi terminada.
    expect((await clients.support.auth.getUser()).error).not.toBeNull();

    const { data: rasto } = await service
      .from("audit_log")
      .select("actor_id, diff")
      .eq("action", "staff.password_set_by_admin")
      .eq("entity_id", ids.support);
    expect(rasto?.[0]?.actor_id).toBe(ids.admin);
    expect(JSON.stringify(rasto)).not.toContain(NEW_PASSWORD);
  });

  it("a de um admin muda-a o outro admin", async () => {
    await setStepUp(ids.admin, new Date());
    const { error } = await clients.admin.rpc("admin_set_staff_password", {
      p_profile_id: ids.admin2,
      p_password: NEW_PASSWORD,
    });
    expect(error).toBeNull();
    expect((await signIn(USERS.admin2.email, NEW_PASSWORD)).error).toBeNull();
  });
});
