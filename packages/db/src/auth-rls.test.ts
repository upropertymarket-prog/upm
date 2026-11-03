/**
 * Matriz de acesso e rate limiting da Fase 3 (08 §2.3, expande D14) —
 * `staff_auth`, `auth_attempts` e as funções `check_auth_rate_limit` /
 * `record_auth_attempt`. Mesmo padrão e mesmas credenciais de
 * `rls-matrix.test.ts` (07 §12.1, D12/D13).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listarTodosOsUtilizadores } from "./test-users";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasEnv = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

describe.skipIf(!hasEnv)("Fase 3 — staff_auth, auth_attempts, rate limiting", () => {
  let serviceClient: SupabaseClient;
  let adminClient: SupabaseClient;
  let buyerClient: SupabaseClient;
  let adminId: string;
  let buyerId: string;

  const TEST_PASSWORD = "auth-fase3-test-P@ss1";
  const adminEmail = "fase3-admin@upropertymarket.test";
  const buyerEmail = "fase3-buyer@upropertymarket.test";

  async function getOrCreateUser(email: string, role: string) {
    const existing = await listarTodosOsUtilizadores(serviceClient);
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

    adminId = await getOrCreateUser(adminEmail, "admin");
    await serviceClient.from("profiles").update({ role: "admin" }).eq("id", adminId);
    adminClient = createClient(SUPABASE_URL!, ANON_KEY!);
    await adminClient.auth.signInWithPassword({ email: adminEmail, password: TEST_PASSWORD });

    buyerId = await getOrCreateUser(buyerEmail, "buyer");
    buyerClient = createClient(SUPABASE_URL!, ANON_KEY!);
    await buyerClient.auth.signInWithPassword({ email: buyerEmail, password: TEST_PASSWORD });
  });

  afterAll(async () => {
    if (!hasEnv) return;
    await serviceClient.from("staff_auth").delete().in("profile_id", [adminId, buyerId]);
    await serviceClient.auth.admin.deleteUser(adminId);
    await serviceClient.auth.admin.deleteUser(buyerId);
  });

  it("staff_auth: dono lê a própria linha, outro não-admin não lê a de outro", async () => {
    await serviceClient.from("staff_auth").upsert({ profile_id: adminId, pin_hash: "x" });

    const { data: ownRead } = await adminClient
      .from("staff_auth")
      .select("profile_id")
      .eq("profile_id", adminId);
    expect(ownRead?.length ?? 0).toBe(1);

    const { data: otherRead } = await buyerClient
      .from("staff_auth")
      .select("profile_id")
      .eq("profile_id", adminId);
    expect(otherRead?.length ?? 0).toBe(0);
  });

  it("auth_attempts: admin lê, buyer não lê (08 §2.2 — só a policy de admin existe)", async () => {
    await serviceClient.rpc("record_auth_attempt", {
      p_identifier: "matriz-teste@example.com",
      p_kind: "login",
      p_succeeded: false,
    });

    const { data: asAdmin } = await adminClient
      .from("auth_attempts")
      .select("id")
      .eq("identifier", "matriz-teste@example.com");
    expect((asAdmin?.length ?? 0) > 0).toBe(true);

    const { data: asBuyer } = await buyerClient
      .from("auth_attempts")
      .select("id")
      .eq("identifier", "matriz-teste@example.com");
    expect(asBuyer?.length ?? 0).toBe(0);
  });

  it("auth_attempts: insert direto do cliente é recusado (só a função security definer escreve)", async () => {
    const { error } = await buyerClient
      .from("auth_attempts")
      .insert({ identifier: "x@example.com", kind: "login", succeeded: false });
    expect(error).not.toBeNull();
  });

  it("check_auth_rate_limit: bloqueia ao fim de 10 falhas na janela (08 §5.5)", async () => {
    const identifier = `rate-limit-${Date.now()}@example.com`;

    for (let i = 0; i < 10; i++) {
      await serviceClient.rpc("record_auth_attempt", {
        p_identifier: identifier,
        p_kind: "login",
        p_succeeded: false,
      });
    }

    const { data } = await serviceClient.rpc("check_auth_rate_limit", {
      p_identifier: identifier,
      p_kind: "login",
    });
    const result = data as { allowed: boolean; retry_after_seconds: number };
    expect(result.allowed).toBe(false);
    expect(result.retry_after_seconds).toBeGreaterThan(0);
  });

  // A15: com a sessão — e, por isso, com a chave pública — qualquer pessoa
  // registava falhas no e-mail de outra até a trancar fora. Só o servidor.
  it("record_auth_attempt e check_auth_rate_limit: recusados a uma sessão (A15)", async () => {
    const registo = await buyerClient.rpc("record_auth_attempt", {
      p_identifier: `alheio-${Date.now()}@example.com`,
      p_kind: "login",
      p_succeeded: false,
    });
    expect(registo.error).not.toBeNull();
    const consulta = await buyerClient.rpc("check_auth_rate_limit", {
      p_identifier: "x@example.com",
      p_kind: "login",
    });
    expect(consulta.error).not.toBeNull();
  });

  it("check_auth_rate_limit: permite um identificador limpo", async () => {
    const { data } = await serviceClient.rpc("check_auth_rate_limit", {
      p_identifier: `limpo-${Date.now()}@example.com`,
      p_kind: "login",
    });
    const result = data as { allowed: boolean; retry_after_seconds: number };
    expect(result.allowed).toBe(true);
  });

  it("feature_flags: interno_ip_allowlist existe e começa vazio (07 §6)", async () => {
    const { data } = await serviceClient
      .from("feature_flags")
      .select("value")
      .eq("key", "interno_ip_allowlist")
      .single();
    expect(data?.value).toEqual([]);
  });
});
