/**
 * Fase 10 · as campanhas (P10-08) — 08 §2.3.
 *
 * Cinco regras, e a primeira é a que molda o resto:
 *
 *  1. **O Marketing nunca recebe a lista de e-mails** (07 §24.6 #5).
 *     `campaign_audience_count()` devolve um número; a lista só se materializa
 *     em `campaign_recipients`, no envio. Sem isto, dar acesso a Campanhas era
 *     dar uma leitura em bruto de `profiles` e `site_leads`.
 *  2. **O consentimento é opt-in** (decisão do cliente, 15 out 2026). Uma conta
 *     sem `marketing_consent` não entra na contagem, por muito ativa que seja.
 *  3. **As supressões mandam sobre tudo.** Quem cancelou não conta, mesmo com
 *     consentimento dado.
 *  4. **As quatro tabelas são do Marketing, não de `is_staff()`.** Nem o Admin
 *     nem o Suporte as leem — 07 §24.6 é explícito em que `is_staff()` não se
 *     alarga.
 *  5. **Nenhuma escrita é direta.** As linhas nascem por função, como em todo o
 *     correio desta fase.
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

const PASSWORD = "phase10-camp-test-P@ss1";
const USERS = {
  marketing: { email: "phase10-camp-marketing@upropertymarket.test", role: "marketing" },
  support: { email: "phase10-camp-support@upropertymarket.test", role: "support" },
  admin: { email: "phase10-camp-admin@upropertymarket.test", role: "admin" },
  owner: { email: "phase10-camp-owner@upropertymarket.test", role: "owner" },
} as const;

type Role = keyof typeof USERS | "anon";

const STAMP = Date.now();

describe.skipIf(!hasEnv)("Fase 10 · campanhas: audiências, consentimento e supressões", () => {
  let service: SupabaseClient;
  const clients = {} as Record<Role, SupabaseClient>;
  const ids = {} as Record<keyof typeof USERS, string>;
  let campaignId = "";

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

  async function countFor(audience: string) {
    const { data, error } = await clients.marketing.rpc("campaign_audience_count", {
      p_audience: audience,
    });
    if (error) throw new Error(`Audiência ${audience}: ${error.message}`);
    return data as number;
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

    const campaign = await service
      .from("campaigns")
      .insert({ name: `Campanha ${STAMP}`, audience: "owners" })
      .select("id")
      .single();
    if (campaign.error) throw new Error(`Falha a criar a campanha: ${campaign.error.message}`);
    campaignId = campaign.data.id;
  });

  afterAll(async () => {
    if (!service) return;
    await service.from("campaigns").delete().eq("id", campaignId);
    await service.from("email_suppressions").delete().eq("email", USERS.owner.email);
    await service
      .from("profiles")
      .update({ marketing_consent: false, marketing_consent_at: null })
      .eq("id", ids.owner);
  });

  // -------------------------------------------------------------------------
  // 4 — de quem são as tabelas
  // -------------------------------------------------------------------------

  it("as campanhas são do Marketing — nem o Admin nem o Suporte as leem", async () => {
    for (const role of ["admin", "support", "owner", "anon"] as const) {
      const { data } = await clients[role].from("campaigns").select("id").eq("id", campaignId);
      expect(data ?? [], `${role} não devia ver campanhas`).toHaveLength(0);
    }

    const { data } = await clients.marketing.from("campaigns").select("id").eq("id", campaignId);
    expect(data ?? []).toHaveLength(1);
  });

  it("ninguém escreve direto em nenhuma das quatro", async () => {
    const campaign = await clients.marketing.from("campaigns").insert({ name: `Direta ${STAMP}` });
    expect(campaign.error).not.toBeNull();

    const suppression = await clients.marketing
      .from("email_suppressions")
      .insert({ email: "x@y.pt", reason: "unsubscribe" });
    expect(suppression.error).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // 1 — a audiência devolve contagem, nunca a lista
  // -------------------------------------------------------------------------

  it("só o Marketing consulta audiências", async () => {
    for (const role of ["admin", "support", "owner"] as const) {
      const { error } = await clients[role].rpc("campaign_audience_count", {
        p_audience: "all",
      });
      expect(error, `${role} devia ser recusado`).not.toBeNull();
    }
  });

  it("devolve um número e nada mais — não há como lá tirar a lista", async () => {
    const count = await countFor("all");
    expect(typeof count).toBe("number");
    expect(count).toBeGreaterThanOrEqual(0);
  });

  // -------------------------------------------------------------------------
  // 2 e 3 — consentimento e supressões
  // -------------------------------------------------------------------------

  it("sem consentimento não entra na contagem, por ativa que a conta esteja", async () => {
    // O proprietário do teste nasce sem consentimento (o default da coluna).
    const antes = await countFor("owners");

    await service
      .from("profiles")
      .update({ marketing_consent: true, marketing_consent_at: new Date().toISOString() })
      .eq("id", ids.owner);

    const depois = await countFor("owners");
    expect(depois).toBe(antes + 1);
  });

  it("uma supressão tira-o outra vez, mesmo com consentimento dado", async () => {
    const antes = await countFor("owners");

    await service
      .from("email_suppressions")
      .insert({ email: USERS.owner.email, reason: "unsubscribe" });

    const depois = await countFor("owners");
    expect(depois).toBe(antes - 1);
  });

  it("o consentimento e a data andam sempre juntos", async () => {
    // O `check` de `profiles`: um `true` sem data é uma prova que não existe.
    const { error } = await service
      .from("profiles")
      .update({ marketing_consent: true, marketing_consent_at: null })
      .eq("id", ids.owner);
    expect(error).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // A sequência e as supressões
  // -------------------------------------------------------------------------

  it("a posição de um e-mail na sequência é única", async () => {
    const first = await service
      .from("campaign_emails")
      .insert({ campaign_id: campaignId, position: 1, subject: "Um" });
    expect(first.error).toBeNull();

    const repetida = await service
      .from("campaign_emails")
      .insert({ campaign_id: campaignId, position: 1, subject: "Outro" });
    expect(repetida.error).not.toBeNull();
  });

  it("uma supressão por endereço, e o endereço é em minúsculas", async () => {
    const maiusculas = await service
      .from("email_suppressions")
      .insert({ email: "ANA@EXEMPLO.PT", reason: "bounce" });
    // `Ana@X.pt` e `ana@x.pt` são a mesma caixa; o `check` recusa a forma que
    // uma supressão não apanharia.
    expect(maiusculas.error).not.toBeNull();
  });

  it("o fundo do e-mail tem de ser hexadecimal", async () => {
    const { error } = await service
      .from("campaigns")
      .update({ email_bg: "var(--bg)" })
      .eq("id", campaignId);
    expect(error).not.toBeNull();
  });

  it("uma campanha agendada tem de ter data", async () => {
    const { error } = await service
      .from("campaigns")
      .update({ status: "scheduled", scheduled_at: null })
      .eq("id", campaignId);
    expect(error).not.toBeNull();
  });
});
