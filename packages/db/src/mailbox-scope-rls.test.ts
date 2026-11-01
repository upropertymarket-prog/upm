/**
 * Quem vê que caixa — a fronteira de 31 out 2026 (12 §8.1 · 07 §24.6).
 *
 * Até esta data, **qualquer pessoa do Suporte lia todas as mensagens de todas
 * as caixas**, incluindo as do `financeiro`. Não por decisão: as policies
 * diziam `is_staff()`, e o modelo de dados — que tem `mailboxes.department`,
 * `mailboxes.owner_profile_id` e `staff_members.department` desde P10-03 —
 * nunca era consultado.
 *
 * A migração `20261031090000_mailbox_scope` liga as pontas. Este ficheiro
 * existe para que ninguém as volte a desligar sem reparar.
 *
 * **O caso que interessa é o negativo**, e é o terceiro teste: uma pessoa do
 * Suporte, autenticada e legítima, a pedir as mensagens da caixa do financeiro
 * e a receber zero linhas. É o único que distingue a correção de uma boa
 * intenção.
 *
 * Salta inteiro sem credenciais de staging (D13), como os outros `*-rls`.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasEnv = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

const PASSWORD = "mailbox-scope-test-P@ss1";
const STAMP = Date.now();

/**
 * Três pessoas, três situações. A `dono` é de suporte **mas responsável** por
 * uma caixa do financeiro — é o caso que a regra de `owner_profile_id` existe
 * para servir, e o que distingue "departamento" de "âmbito".
 */
const USERS = {
  admin: {
    email: `scope-admin-${STAMP}@upropertymarket.test`,
    role: "admin",
    department: "admin",
  },
  suporte: {
    email: `scope-suporte-${STAMP}@upropertymarket.test`,
    role: "support",
    department: "suporte",
  },
  dono: {
    email: `scope-dono-${STAMP}@upropertymarket.test`,
    role: "support",
    department: "suporte",
  },
} as const;

type Role = keyof typeof USERS;

describe.skipIf(!hasEnv)("Âmbito do correio — quem vê que caixa", () => {
  let service: SupabaseClient;
  const clients = {} as Record<Role, SupabaseClient>;
  const ids = {} as Record<Role, string>;
  let caixaSuporte = "";
  let caixaFinanceiro = "";

  async function criarUtilizador(email: string, role: string) {
    const { data, error } = await service.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { role },
    });
    if (error || !data.user) throw new Error(`Falha a criar ${email}: ${error?.message}`);
    return data.user.id;
  }

  async function criarCaixa(department: string, ownerProfileId: string | null) {
    const address = `scope-${department}-${STAMP}@upropertymarket.test`;
    const { data, error } = await service
      .from("mailboxes")
      .insert({
        address,
        display_name: `Caixa ${department}`,
        in_host: "imap.exemplo.test",
        in_port: 993,
        smtp_host: "smtp.exemplo.test",
        smtp_port: 587,
        username: address,
        department,
        owner_profile_id: ownerProfileId,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Falha a criar a caixa ${department}: ${error.message}`);

    const { error: msgError } = await service.from("mail_messages").insert({
      mailbox_id: data.id,
      message_id: `<scope-${department}-${STAMP}@upropertymarket.test>`,
      from_address: "externo@exemplo.test",
      from_name: "Remetente",
      subject: `Assunto de ${department}`,
      text_body: "Corpo.",
    });
    if (msgError) throw new Error(`Falha a criar a mensagem: ${msgError.message}`);

    return data.id as string;
  }

  beforeAll(async () => {
    service = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);

    for (const role of Object.keys(USERS) as Role[]) {
      const fixture = USERS[role];
      const id = await criarUtilizador(fixture.email, fixture.role);
      ids[role] = id;

      const { error } = await service
        .from("profiles")
        .update({ role: fixture.role, status: "active" })
        .eq("id", id);
      if (error) throw new Error(`Falha a preparar ${role}: ${error.message}`);

      const { error: staffError } = await service
        .from("staff_members")
        .upsert({ profile_id: id, department: fixture.department }, { onConflict: "profile_id" });
      if (staffError) throw new Error(`Falha em staff_members: ${staffError.message}`);

      const client = createClient(SUPABASE_URL!, ANON_KEY!);
      const { error: signInError } = await client.auth.signInWithPassword({
        email: fixture.email,
        password: PASSWORD,
      });
      if (signInError) throw new Error(`Falha a autenticar ${fixture.email}`);
      clients[role] = client;
    }

    caixaSuporte = await criarCaixa("suporte", null);
    caixaFinanceiro = await criarCaixa("financeiro", ids.dono);
  });

  afterAll(async () => {
    if (!service) return;
    for (const id of [caixaSuporte, caixaFinanceiro]) {
      if (id) await service.from("mailboxes").delete().eq("id", id);
    }
    for (const role of Object.keys(USERS) as Role[]) {
      if (ids[role]) await service.auth.admin.deleteUser(ids[role]).catch(() => undefined);
    }
  });

  const mensagensDe = async (quem: Role, caixa: string) =>
    clients[quem].from("mail_messages").select("id").eq("mailbox_id", caixa);

  it("o Suporte vê as mensagens da SUA caixa", async () => {
    const { data } = await mensagensDe("suporte", caixaSuporte);
    expect(data?.length).toBe(1);
  });

  it("o Suporte NÃO vê as mensagens do financeiro", async () => {
    // O teste que justifica a migração inteira. Antes de 31 out 2026 isto
    // devolvia a mensagem, e era por omissão, não por decisão.
    const { data, error } = await mensagensDe("suporte", caixaFinanceiro);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("nem a própria caixa do financeiro na lista de caixas", async () => {
    const { data } = await clients.suporte.from("mailboxes").select("id").eq("id", caixaFinanceiro);
    expect(data).toEqual([]);
  });

  it("mas vê a sua na lista", async () => {
    const { data } = await clients.suporte.from("mailboxes").select("id").eq("id", caixaSuporte);
    expect(data?.length).toBe(1);
  });

  it("quem é RESPONSÁVEL por uma caixa de outro departamento vê-a", async () => {
    // `owner_profile_id` é o que distingue "departamento" de "âmbito": a
    // pessoa é do suporte, a caixa é do financeiro, e ela responde por ela.
    const { data } = await mensagensDe("dono", caixaFinanceiro);
    expect(data?.length).toBe(1);
  });

  it("o Admin vê as duas — é ele que as administra", async () => {
    const suporte = await mensagensDe("admin", caixaSuporte);
    const financeiro = await mensagensDe("admin", caixaFinanceiro);
    expect(suporte.data?.length).toBe(1);
    expect(financeiro.data?.length).toBe(1);
  });

  it("os marcadores seguem a caixa", async () => {
    const { error } = await clients.suporte
      .from("mail_labels")
      .insert({ mailbox_id: caixaFinanceiro, name: `intruso-${STAMP}`, color: "accent" });
    // Quem não vê a caixa não tem o que marcar nela.
    expect(error).not.toBeNull();
  });
});
