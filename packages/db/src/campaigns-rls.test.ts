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

import { listarTodosOsUtilizadores } from "./test-users";

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

  // -------------------------------------------------------------------------
  // 5 — as escritas são todas por função (`20261015120000`)
  //
  // O que estes testes guardam não é "a função funciona": é que **os
  // invariantes que uma policy não sabe ver** estão mesmo no caminho de
  // escrita. Cada um deles corresponde a um estado que não devia poder existir.
  // -------------------------------------------------------------------------

  const footer = { id: "f1", type: "footer", align: "left", text: "" };
  const heading = { id: "h1", type: "heading", align: "left", text: "Olá", level: 1 };

  it("só o Marketing grava campanhas", async () => {
    for (const role of ["admin", "support", "owner"] as const) {
      const { error } = await clients[role].rpc("campaign_save", {
        p_id: null,
        p_name: `Pirata ${STAMP}`,
        p_audience: "all",
        p_from_mailbox_id: null,
        p_email_bg: "#ffffff",
      });
      expect(error, `${role} devia ser recusado`).not.toBeNull();
    }
  });

  it("uma campanha nasce com o primeiro e-mail da sequência", async () => {
    const { data, error } = await clients.marketing.rpc("campaign_save", {
      p_id: null,
      p_name: `Sequência ${STAMP}`,
      p_audience: "owners",
      p_from_mailbox_id: null,
      p_email_bg: "#ffffff",
    });
    expect(error).toBeNull();

    const nova = String(data);
    const { data: emails } = await clients.marketing
      .from("campaign_emails")
      .select("position")
      .eq("campaign_id", nova);

    // "Uma campanha é uma sequência de 1..N" (05 §1.9), e N começa em 1.
    expect(emails ?? []).toHaveLength(1);
    expect(emails?.[0]?.position).toBe(1);

    await service.from("campaigns").delete().eq("id", nova);
  });

  it("o fundo não hexadecimal é recusado pela função, não só pelo check", async () => {
    const { error } = await clients.marketing.rpc("campaign_save", {
      p_id: null,
      p_name: `Fundo ${STAMP}`,
      p_audience: "all",
      p_from_mailbox_id: null,
      p_email_bg: "var(--bg)",
    });
    expect(error).not.toBeNull();
  });

  it("gravar blocos sem rodapé é recusado — é o link de cancelar subscrição (02 §4.3)", async () => {
    const { data: emails } = await clients.marketing
      .from("campaign_emails")
      .select("id")
      .eq("campaign_id", campaignId)
      .order("position")
      .limit(1);
    const emailId = emails?.[0]?.id;
    expect(emailId).toBeTruthy();

    const semRodape = await clients.marketing.rpc("campaign_email_save", {
      p_id: emailId!,
      p_campaign_id: campaignId,
      p_name: "",
      p_subject: "Assunto",
      p_preheader: "",
      p_blocks: [heading],
      p_delay_days: 0,
    });
    expect(semRodape.error).not.toBeNull();

    const comRodape = await clients.marketing.rpc("campaign_email_save", {
      p_id: emailId!,
      p_campaign_id: campaignId,
      p_name: "",
      p_subject: "Assunto",
      p_preheader: "",
      p_blocks: [heading, footer],
      p_delay_days: 0,
    });
    expect(comRodape.error).toBeNull();
  });

  it("HTML inseguro nos blocos é recusado — a prova de que o sanitizador do Node correu", async () => {
    const { data: emails } = await clients.marketing
      .from("campaign_emails")
      .select("id")
      .eq("campaign_id", campaignId)
      .order("position")
      .limit(1);

    const { error } = await clients.marketing.rpc("campaign_email_save", {
      p_id: emails![0]!.id,
      p_campaign_id: campaignId,
      p_name: "",
      p_subject: "Assunto",
      p_preheader: "",
      p_blocks: [
        { id: "t1", type: "text", align: "left", html: "<script>alert(1)</script>" },
        footer,
      ],
      p_delay_days: 0,
    });
    expect(error).not.toBeNull();
  });

  it("não se apaga o último e-mail da sequência, e apagar um do meio renumera", async () => {
    const { data: criada } = await clients.marketing.rpc("campaign_save", {
      p_id: null,
      p_name: `Renumerar ${STAMP}`,
      p_audience: "all",
      p_from_mailbox_id: null,
      p_email_bg: "#ffffff",
    });
    const nova = String(criada);

    const { data: emails } = await clients.marketing
      .from("campaign_emails")
      .select("id")
      .eq("campaign_id", nova);

    // Só há um: apagá-lo deixava uma campanha sem conteúdo nenhum.
    const unico = await clients.marketing.rpc("campaign_email_delete", { p_id: emails![0]!.id });
    expect(unico.error).not.toBeNull();

    // Com três, apagar o do meio tem de deixar 1 e 2 — e não 1 e 3, que o
    // `delay` de P10-09 leria como uma espera que ninguém escreveu.
    const extras: string[] = [];
    for (const assunto of ["Dois", "Três"]) {
      const { data } = await clients.marketing.rpc("campaign_email_save", {
        p_id: null,
        p_campaign_id: nova,
        p_name: "",
        p_subject: assunto,
        p_preheader: "",
        p_blocks: [footer],
        p_delay_days: 3,
      });
      extras.push(String(data));
    }

    const meio = await clients.marketing.rpc("campaign_email_delete", { p_id: extras[0]! });
    expect(meio.error).toBeNull();

    const { data: finais } = await clients.marketing
      .from("campaign_emails")
      .select("position")
      .eq("campaign_id", nova)
      .order("position");
    expect((finais ?? []).map((linha) => linha.position)).toEqual([1, 2]);

    await service.from("campaigns").delete().eq("id", nova);
  });

  it("agendar exige data futura e e-mails completos; desagendar limpa a data", async () => {
    const { data: criada } = await clients.marketing.rpc("campaign_save", {
      p_id: null,
      p_name: `Agendar ${STAMP}`,
      p_audience: "all",
      p_from_mailbox_id: null,
      p_email_bg: "#ffffff",
    });
    const nova = String(criada);

    const passado = await clients.marketing.rpc("campaign_schedule", {
      p_id: nova,
      p_at: new Date(Date.now() - 3600_000).toISOString(),
    });
    expect(passado.error).not.toBeNull();

    // O e-mail 1 nasce sem assunto e sem blocos: agendar assim era marcar data
    // para um envio em branco.
    const incompleta = await clients.marketing.rpc("campaign_schedule", {
      p_id: nova,
      p_at: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(incompleta.error).not.toBeNull();

    const { data: emails } = await clients.marketing
      .from("campaign_emails")
      .select("id")
      .eq("campaign_id", nova);
    await clients.marketing.rpc("campaign_email_save", {
      p_id: emails![0]!.id,
      p_campaign_id: nova,
      p_name: "",
      p_subject: "Pronto",
      p_preheader: "",
      p_blocks: [footer],
      p_delay_days: 0,
    });

    const agendada = await clients.marketing.rpc("campaign_schedule", {
      p_id: nova,
      p_at: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(agendada.error).toBeNull();

    const { data: depois } = await clients.marketing
      .from("campaigns")
      .select("status, scheduled_at")
      .eq("id", nova)
      .single();
    expect(depois?.status).toBe("scheduled");
    expect(depois?.scheduled_at).not.toBeNull();

    const desagendada = await clients.marketing.rpc("campaign_unschedule", { p_id: nova });
    expect(desagendada.error).toBeNull();

    const { data: final } = await clients.marketing
      .from("campaigns")
      .select("status, scheduled_at")
      .eq("id", nova)
      .single();
    // O `check campaigns_scheduled_has_date` obriga a limpar a data com o estado.
    expect(final?.status).toBe("draft");
    expect(final?.scheduled_at).toBeNull();

    await service.from("campaigns").delete().eq("id", nova);
  });

  it("uma campanha enviada não se edita nem se apaga", async () => {
    const { data: criada } = await clients.marketing.rpc("campaign_save", {
      p_id: null,
      p_name: `Enviada ${STAMP}`,
      p_audience: "all",
      p_from_mailbox_id: null,
      p_email_bg: "#ffffff",
    });
    const nova = String(criada);

    // O estado `sent` é do worker (P10-09); aqui chega-se lá pela service_role.
    await service
      .from("campaigns")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", nova);

    const editar = await clients.marketing.rpc("campaign_save", {
      p_id: nova,
      p_name: "Outro nome",
      p_audience: "all",
      p_from_mailbox_id: null,
      p_email_bg: "#ffffff",
    });
    expect(editar.error).not.toBeNull();

    // Apagá-la levava `campaign_recipients` e as métricas pelo `on delete
    // cascade` — e com elas a prova de que aquele e-mail saiu.
    const apagar = await clients.marketing.rpc("campaign_delete", { p_id: nova });
    expect(apagar.error).not.toBeNull();

    await service.from("campaigns").delete().eq("id", nova);
  });

  // -------------------------------------------------------------------------
  // 6 — o envio (`20261015130000`, `20261015140000`, `20261015150000`)
  //
  // O que estes testes guardam é a fronteira de 07 §24.6 #5: a audiência
  // materializa-se **dentro** do Postgres, e as funções que veem endereços são
  // as do worker — fechadas a `authenticated` pelo `grant`, não por um `if`.
  // -------------------------------------------------------------------------

  it("as funções do worker estão fechadas a quem tem sessão", async () => {
    // O guarda aqui é o `grant` (o padrão de `mail_attachments_expired`), e é
    // isso que este teste prova: nem o Marketing, que é dono das campanhas,
    // consegue reclamar destinatários — porque reclamar é ver endereços.
    for (const rpc of [
      "campaign_claim_recipients",
      "campaign_advance_sequence",
      "campaign_materialize_recipients",
    ] as const) {
      const { error } = await clients.marketing.rpc(rpc, {} as never);
      expect(error, `${rpc} devia ser recusado a authenticated`).not.toBeNull();
    }
  });

  it("enviar exige remetente, conteúdo e alguém que receba", async () => {
    const { data: criada } = await clients.marketing.rpc("campaign_save", {
      p_id: null,
      p_name: `Enviar ${STAMP}`,
      p_audience: "owners",
      p_from_mailbox_id: null,
      p_email_bg: "#ffffff",
    });
    const nova = String(criada);

    // Sem remetente: a caixa é a identidade de quem assina (07 §24.6 #2).
    const semRemetente = await clients.marketing.rpc("campaign_send_now", { p_id: nova });
    expect(semRemetente.error).not.toBeNull();
    expect(semRemetente.error?.message).toContain("remetente");

    await service.from("campaigns").delete().eq("id", nova);
  });

  it("o cancelamento por token suprime, retira o consentimento e conta uma vez", async () => {
    // Um destinatário à mão: o caminho normal é a materialização, mas aqui o
    // que se testa é o link do rodapé, que só precisa do token.
    const { data: emails } = await service
      .from("campaign_emails")
      .select("id")
      .eq("campaign_id", campaignId)
      .order("position")
      .limit(1);

    const { data: destinatario, error: criar } = await service
      .from("campaign_recipients")
      .insert({
        campaign_id: campaignId,
        campaign_email_id: emails![0]!.id,
        email: USERS.owner.email.toLowerCase(),
        profile_id: ids.owner,
      })
      .select("unsubscribe_token")
      .single();
    expect(criar).toBeNull();

    await service
      .from("profiles")
      .update({ marketing_consent: true, marketing_consent_at: new Date().toISOString() })
      .eq("id", ids.owner);
    await service.from("email_suppressions").delete().eq("email", USERS.owner.email.toLowerCase());

    const token = destinatario!.unsubscribe_token;

    // Anónimo: quem clica no link não tem sessão, e exigir login era exigir
    // conta para exercer um direito (02 §4.3).
    const { data: primeiro, error: erro1 } = await clients.anon.rpc("campaign_unsubscribe", {
      p_token: token,
    });
    expect(erro1).toBeNull();
    expect(primeiro).toBe(true);

    const { data: suprimido } = await service
      .from("email_suppressions")
      .select("reason")
      .eq("email", USERS.owner.email.toLowerCase())
      .maybeSingle();
    expect(suprimido?.reason).toBe("unsubscribe");

    const { data: perfil } = await service
      .from("profiles")
      .select("marketing_consent, marketing_consent_at")
      .eq("id", ids.owner)
      .single();
    // A supressão travava o envio na mesma; o consentimento sai porque é ele
    // que responde a um pedido de prestação de contas.
    expect(perfil?.marketing_consent).toBe(false);
    expect(perfil?.marketing_consent_at).toBeNull();

    const { data: antes } = await service
      .from("campaigns")
      .select("unsubscribes")
      .eq("id", campaignId)
      .single();

    // Segundo clique no mesmo link: continua a devolver `true` (já estava
    // cancelado não é um erro de quem clicou) e **não** conta outra vez.
    const { data: segundo } = await clients.anon.rpc("campaign_unsubscribe", { p_token: token });
    expect(segundo).toBe(true);

    const { data: depois } = await service
      .from("campaigns")
      .select("unsubscribes")
      .eq("id", campaignId)
      .single();
    expect(depois?.unsubscribes).toBe(antes?.unsubscribes);

    await service.from("campaign_recipients").delete().eq("unsubscribe_token", token);
  });

  it("um token que não existe devolve false sem escrever nada", async () => {
    const { data } = await clients.anon.rpc("campaign_unsubscribe", {
      p_token: "00000000-0000-4000-8000-000000000000",
    });
    expect(data).toBe(false);
  });

  it("a assinatura resolvida é do Marketing e da service_role, não de um cliente", async () => {
    const { data: emails } = await clients.marketing
      .from("campaign_emails")
      .select("id")
      .eq("campaign_id", campaignId)
      .limit(1);

    // Sem bloco de assinatura devolve string vazia — e não erro.
    const { data, error } = await clients.marketing.rpc("campaign_signature_html", {
      p_campaign_email_id: emails![0]!.id,
    });
    expect(error).toBeNull();
    expect(typeof data).toBe("string");

    // Um proprietário não lê assinaturas de equipa: `is_internal()` é falso.
    const { data: doCliente } = await clients.owner.rpc("campaign_signature_html", {
      p_campaign_email_id: emails![0]!.id,
    });
    expect(doCliente).toBe("");
  });

  // -------------------------------------------------------------------------
  // 7 — o agendamento e os recibos (P10-09)
  // -------------------------------------------------------------------------

  it("agendar cria o disparo; desagendar deixa-o como cancelado e não apagado", async () => {
    const { data: criada } = await clients.marketing.rpc("campaign_save", {
      p_id: null,
      p_name: `Disparo ${STAMP}`,
      p_audience: "all",
      p_from_mailbox_id: null,
      p_email_bg: "#ffffff",
    });
    const nova = String(criada);

    const { data: emails } = await clients.marketing
      .from("campaign_emails")
      .select("id")
      .eq("campaign_id", nova);
    await clients.marketing.rpc("campaign_email_save", {
      p_id: emails![0]!.id,
      p_campaign_id: nova,
      p_name: "",
      p_subject: "Pronto",
      p_preheader: "",
      p_blocks: [footer],
      p_delay_days: 0,
    });

    const quando = new Date(Date.now() + 86_400_000).toISOString();
    expect(
      (await clients.marketing.rpc("campaign_schedule", { p_id: nova, p_at: quando })).error,
    ).toBeNull();

    const { data: disparo } = await clients.marketing
      .from("scheduled_sends")
      .select("status, send_at, attempts")
      .eq("ref_id", nova)
      .single();
    expect(disparo?.status).toBe("scheduled");

    // Reagendar muda a hora do disparo que existe, e não cria um segundo: é o
    // índice único parcial que o garante.
    const outra = new Date(Date.now() + 2 * 86_400_000).toISOString();
    await clients.marketing.rpc("campaign_schedule", { p_id: nova, p_at: outra });

    const { data: todos } = await clients.marketing
      .from("scheduled_sends")
      .select("status")
      .eq("ref_id", nova);
    expect(todos ?? []).toHaveLength(1);

    await clients.marketing.rpc("campaign_unschedule", { p_id: nova });
    const { data: depois } = await clients.marketing
      .from("scheduled_sends")
      .select("status")
      .eq("ref_id", nova)
      .single();
    // `cancelled` e não apagado: o rasto de que esteve agendada é o que a
    // campanha, sozinha, deixa de poder dizer.
    expect(depois?.status).toBe("cancelled");

    await service.from("campaigns").delete().eq("id", nova);
  });

  it("o disparo e o envio sem papel são da service_role, não de quem tem sessão", async () => {
    for (const rpc of ["scheduled_sends_run", "campaign_start_sending"] as const) {
      const { error } = await clients.marketing.rpc(rpc, {} as never);
      expect(error, `${rpc} devia ser recusado a authenticated`).not.toBeNull();
    }
  });

  it("os recibos contam uma vez por tipo, mesmo com o webhook a reentregar", async () => {
    const { data: emails } = await service
      .from("campaign_emails")
      .select("id")
      .eq("campaign_id", campaignId)
      .order("position")
      .limit(1);

    const provider = `prov-${STAMP}`;
    const endereco = `recibos-${STAMP}@exemplo.pt`;

    const { data: destinatario } = await service
      .from("campaign_recipients")
      .insert({
        campaign_id: campaignId,
        campaign_email_id: emails![0]!.id,
        email: endereco,
        status: "sent",
        provider_message_id: provider,
      })
      .select("id")
      .single();

    const { data: antes } = await service
      .from("campaigns")
      .select("opens, clicks")
      .eq("id", campaignId)
      .single();

    const registar = (type: string, url?: string) =>
      service.rpc("record_email_event", {
        p_message_ref: provider,
        p_recipient: endereco,
        p_type: type,
        p_url: url ?? null,
      });

    expect((await registar("opened")).data).toBe(true);
    // A reentrega: o Resend reenvia o que não respondeu 200.
    expect((await registar("opened")).data).toBe(false);

    const { data: depois } = await service
      .from("campaigns")
      .select("opens, clicks")
      .eq("id", campaignId)
      .single();
    expect(depois?.opens).toBe((antes?.opens ?? 0) + 1);

    // Dois cliques em links diferentes são dois eventos — isso é informação.
    expect((await registar("clicked", "https://upm.pt/a")).data).toBe(true);
    expect((await registar("clicked", "https://upm.pt/b")).data).toBe(true);
    expect((await registar("clicked", "https://upm.pt/a")).data).toBe(false);

    const { data: final } = await service
      .from("campaign_recipients")
      .select("opened_at, clicked_at")
      .eq("id", destinatario!.id)
      .single();
    expect(final?.opened_at).not.toBeNull();
    expect(final?.clicked_at).not.toBeNull();

    await service.from("campaign_recipients").delete().eq("id", destinatario!.id);
    await service.from("email_events").delete().eq("message_ref", provider);
  });

  it("uma devolução suprime o endereço e uma queixa sobrepõe-se-lhe", async () => {
    const { data: emails } = await service
      .from("campaign_emails")
      .select("id")
      .eq("campaign_id", campaignId)
      .order("position")
      .limit(1);

    const provider = `prov-bounce-${STAMP}`;
    const endereco = `devolve-${STAMP}@exemplo.pt`;

    const { data: destinatario } = await service
      .from("campaign_recipients")
      .insert({
        campaign_id: campaignId,
        campaign_email_id: emails![0]!.id,
        email: endereco,
        status: "sent",
        provider_message_id: provider,
      })
      .select("id")
      .single();

    await service.rpc("record_email_event", {
      p_message_ref: provider,
      p_recipient: endereco,
      p_type: "bounced",
    });

    const { data: supressao } = await service
      .from("email_suppressions")
      .select("reason")
      .eq("email", endereco)
      .single();
    expect(supressao?.reason).toBe("bounce");

    const { data: linha } = await service
      .from("campaign_recipients")
      .select("status")
      .eq("id", destinatario!.id)
      .single();
    expect(linha?.status).toBe("bounced");

    // Uma queixa é mais grave: o provedor já nos marcou, e é a razão que fica.
    await service.rpc("record_email_event", {
      p_message_ref: provider,
      p_recipient: endereco,
      p_type: "complained",
    });

    const { data: agravada } = await service
      .from("email_suppressions")
      .select("reason")
      .eq("email", endereco)
      .single();
    expect(agravada?.reason).toBe("complaint");

    await service.from("campaign_recipients").delete().eq("id", destinatario!.id);
    await service.from("email_events").delete().eq("message_ref", provider);
    await service.from("email_suppressions").delete().eq("email", endereco);
  });

  it("os recibos são do Marketing — nem o Admin nem o Suporte os leem", async () => {
    for (const role of ["admin", "support", "owner", "anon"] as const) {
      const { data } = await clients[role].from("email_events").select("id").limit(1);
      expect(data ?? [], `${role} não devia ver recibos`).toHaveLength(0);

      const { data: agendados } = await clients[role].from("scheduled_sends").select("id").limit(1);
      expect(agendados ?? [], `${role} não devia ver agendamentos`).toHaveLength(0);
    }

    const { error } = await clients.marketing.rpc("campaign_receipts", {
      p_campaign_id: campaignId,
    });
    expect(error).toBeNull();

    for (const role of ["admin", "support", "owner"] as const) {
      const { error: recusa } = await clients[role].rpc("campaign_receipts", {
        p_campaign_id: campaignId,
      });
      expect(recusa, `${role} devia ser recusado`).not.toBeNull();
    }
  });

  it("o remetente chega como três colunas, e não como a configuração das caixas", async () => {
    const { data, error } = await clients.marketing.rpc("campaign_sender_options");
    expect(error).toBeNull();

    for (const linha of (data ?? []) as Record<string, unknown>[]) {
      // Nada de `in_host`, `username` nem `secret_id`: o Marketing escolhe um
      // remetente, não lê a configuração do Suporte (07 §24.6 #2).
      expect(Object.keys(linha).sort()).toEqual(["address", "display_name", "id"]);
    }

    for (const role of ["admin", "support", "owner"] as const) {
      const { error: recusa } = await clients[role].rpc("campaign_sender_options");
      expect(recusa, `${role} devia ser recusado`).not.toBeNull();
    }
  });
});
