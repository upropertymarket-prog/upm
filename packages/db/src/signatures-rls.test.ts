/**
 * Fase 10 · o editor de assinaturas (P10-06) — 08 §2.3.
 *
 * As quatro regras que vivem na base de dados:
 *
 *  1. **Escrever é do Suporte, e por função.** `email_signatures` continua sem
 *     policy de `insert`/`update`/`delete`: nem o Admin nem o Suporte escrevem
 *     direto. A assinatura é de quem responde ao cliente (07 §24.6 #3).
 *  2. **Uma assinatura para toda a empresa** (29 out 2026). A tabela tem no
 *     máximo uma linha, e `mailbox_signature()` devolve-a resolvida com os dados
 *     do dono de cada caixa.
 *  3. **O HTML inseguro é recusado pela função.** Não é a defesa — a
 *     sanitização é do servidor Node (02 §4.3) — é a prova de que a defesa
 *     correu. Se isto passar, há um caminho de escrita que não passou pela action.
 *  4. **As variáveis resolvem-se na base de dados**, uma vez, para o composer e
 *     o editor obterem exatamente a mesma coisa.
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

const PASSWORD = "phase10-sig-test-P@ss1";
const USERS = {
  admin: { email: "phase10-sig-admin@upropertymarket.test", role: "admin" },
  support: { email: "phase10-sig-support@upropertymarket.test", role: "support" },
  buyer: { email: "phase10-sig-buyer@upropertymarket.test", role: "buyer" },
} as const;

type Role = keyof typeof USERS | "anon";

const STAMP = Date.now();
const ADDRESS = `assinaturas-${STAMP}@upropertymarket.test`;
const HTML = `<p>{{nome}} · {{cargo}}</p><p>{{email}}</p>`;

describe.skipIf(!hasEnv)(
  "Fase 10 · assinaturas: escrita por função e uma só para a empresa",
  () => {
    let service: SupabaseClient;
    const clients = {} as Record<Role, SupabaseClient>;
    let mailboxId = "";
    let supportId = "";
    const created: string[] = [];
    // A assinatura da empresa que já estava em staging, para a repor no fim:
    // com uma linha só, o teste escreve por cima da verdadeira.
    let original: { id: string; html: string } | null = null;

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

    beforeAll(async () => {
      service = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);
      clients.anon = createClient(SUPABASE_URL!, ANON_KEY!);

      for (const role of Object.keys(USERS) as (keyof typeof USERS)[]) {
        const fixture = USERS[role];
        const id = await getOrCreateUser(fixture.email, fixture.role);
        if (role === "support") supportId = id;

        const { error } = await service
          .from("profiles")
          .update({ role: fixture.role, status: "active", full_name: "Ana Suporte" })
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

      // A caixa é do perfil do Suporte: é de lá que as variáveis saem.
      // `department` é `staff_department`, cujos valores estão **em português**
      // desde `20260926120000` (`suporte`, `financeiro`, `moderacao`, `admin`).
      // É também o que `{{departamento}}` mostra, por `department::text`.
      await service
        .from("staff_members")
        .upsert({ profile_id: supportId, department: "suporte", title: "Técnica de Suporte" });

      const mailbox = await service
        .from("mailboxes")
        .insert({
          address: ADDRESS,
          display_name: "Caixa das assinaturas",
          in_host: "imap.exemplo.test",
          in_port: 993,
          smtp_host: "smtp.exemplo.test",
          smtp_port: 587,
          username: ADDRESS,
          owner_profile_id: supportId,
        })
        .select("id")
        .single();
      if (mailbox.error) throw new Error(`Falha a criar a caixa: ${mailbox.error.message}`);
      mailboxId = mailbox.data.id;

      const { data: existing } = await service
        .from("email_signatures")
        .select("id, html")
        .limit(1)
        .maybeSingle();
      original = existing ?? null;
    });

    afterAll(async () => {
      if (!service) return;
      if (original) {
        await service
          .from("email_signatures")
          .update({ html: original.html })
          .eq("id", original.id);
      } else {
        for (const id of created) await service.from("email_signatures").delete().eq("id", id);
      }
      await service.from("mailboxes").delete().eq("id", mailboxId);
    });

    // -------------------------------------------------------------------------
    // Leitura e escrita direta
    // -------------------------------------------------------------------------

    it("anon não lê assinaturas", async () => {
      const { data } = await clients.anon.from("email_signatures").select("id");
      expect(data ?? []).toHaveLength(0);
    });

    it("um comprador autenticado também não", async () => {
      const { data } = await clients.buyer.from("email_signatures").select("id");
      expect(data ?? []).toHaveLength(0);
    });

    it("nem o Suporte insere direto — a escrita é pela função", async () => {
      const { error } = await clients.support
        .from("email_signatures")
        .insert({ name: `direta-${STAMP}`, html: "<p>x</p>" });
      expect(error).not.toBeNull();
    });

    // -------------------------------------------------------------------------
    // email_signature_save — a linha única
    // -------------------------------------------------------------------------

    it("o Suporte guarda, e voltar a guardar reescreve a mesma linha", async () => {
      const { data, error } = await clients.support.rpc("email_signature_save", { p_html: HTML });
      expect(error).toBeNull();
      expect(typeof data).toBe("string");
      created.push(data as string);

      const again = await clients.support.rpc("email_signature_save", {
        p_html: `${HTML}<p>{{telefone}}</p>`,
      });
      expect(again.error).toBeNull();
      expect(again.data).toBe(data);
    });

    it("uma assinatura para toda a empresa — a tabela recusa uma segunda linha", async () => {
      const { error } = await service
        .from("email_signatures")
        .insert({ name: `Segunda ${STAMP}`, html: "<p>a</p>" });
      expect(error).not.toBeNull();

      const { data } = await service.from("email_signatures").select("id");
      expect(data ?? []).toHaveLength(1);
    });

    it("o Admin não edita a assinatura — ela vive no Suporte (07 §24.6 #3)", async () => {
      const { error } = await clients.admin.rpc("email_signature_save", { p_html: "<p>x</p>" });
      expect(error).not.toBeNull();
    });

    it("recusa HTML inseguro — é a prova de que a sanitização correu", async () => {
      for (const html of [
        "<p>a</p><script>alert(1)</script>",
        '<img src="x" onerror="alert(1)" />',
        '<a href="javascript:alert(1)">x</a>',
        "<style>p{color:red}</style>",
      ]) {
        const { error } = await clients.support.rpc("email_signature_save", { p_html: html });
        expect(error, `devia ter recusado: ${html}`).not.toBeNull();
      }
    });

    // -------------------------------------------------------------------------
    // As variáveis
    // -------------------------------------------------------------------------

    it("resolve as variáveis com os dados do dono da caixa", async () => {
      const { data, error } = await clients.support.rpc("resolve_signature_variables", {
        p_html: "<p>{{nome}} · {{cargo}} · {{departamento}} · {{email}} · {{iniciais}}</p>",
        p_mailbox_id: mailboxId,
      });
      expect(error).toBeNull();
      expect(data).toContain("Ana Suporte");
      expect(data).toContain("Técnica de Suporte");
      expect(data).toContain(ADDRESS);
      expect(data).toContain("· A<");
      expect(data).not.toContain("{{");
    });

    it("o composer e o editor obtêm o mesmo — é a mesma função por baixo", async () => {
      const viaComposer = await clients.support.rpc("mailbox_signature", {
        p_mailbox_id: mailboxId,
      });
      const viaEditor = await clients.support.rpc("resolve_signature_variables", {
        p_html: `${HTML}<p>{{telefone}}</p>`,
        p_mailbox_id: mailboxId,
      });
      expect(viaComposer.data).toBe(viaEditor.data);
    });

    it("um comprador não resolve variáveis — são dados de um colega", async () => {
      const { data } = await clients.buyer.rpc("resolve_signature_variables", {
        p_html: "<p>{{nome}}</p>",
        p_mailbox_id: mailboxId,
      });
      expect(data).toBe("");
    });

    // -------------------------------------------------------------------------
    // Tirar a assinatura
    // -------------------------------------------------------------------------

    it("gravar o HTML vazio tira a assinatura de todas as caixas", async () => {
      const ok = await clients.support.rpc("email_signature_save", { p_html: "" });
      expect(ok.error).toBeNull();

      const { data } = await clients.support.rpc("mailbox_signature", { p_mailbox_id: mailboxId });
      expect(data).toBe("");
    });
  },
);
