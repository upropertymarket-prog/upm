/**
 * A8 · auditoria uniforme das ações de staff (12 §9.2, §25).
 *
 * As três garantias, e porque cada uma se prova assim:
 *
 *  1. **Append-only para todos.** `audit_log` e `personal_data_access_log`
 *     recusam `update`, `delete` e `truncate` — também à `service_role`, que
 *     não passa por RLS e era, até 2 nov, a porta aberta. Prova-se tentando,
 *     com a própria chave de serviço.
 *  2. **Toda a escrita de staff deixa rasto**, por trigger, sem a ação ter de
 *     se lembrar. A lista de tabelas vigiadas é uma decisão: o teste estático
 *     recusa que uma delas perca o trigger em silêncio.
 *  3. **Sem dados pessoais no rasto**: guarda-se o nome das colunas mudadas,
 *     nunca os valores.
 *
 * Estática corre sempre; comportamental salta sem credenciais (D13).
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listarTodosOsUtilizadores } from "./test-users";

const MIGRACOES = fileURLToPath(new URL("../../../supabase/migrations", import.meta.url));

/**
 * As tabelas que o staff altera e que, por isso, têm de ter o trigger. Tirar
 * uma daqui é uma decisão de deixar de auditar essa área — tem de se ver no
 * diff deste ficheiro, não acontecer por omissão numa migração.
 *
 * **Tabela nova em que o staff escreve ⇒ trigger `audit_staff_write` numa
 * migração, e o nome aqui.** Se a escrita é por policy de RLS, o teste
 * `toda a tabela em que o staff pode escrever por RLS está vigiada` recusa o
 * esquecimento sozinho. Se é só por RPC `security definer`, não a vê: entra à
 * mão — e na dúvida entra, que um trigger a mais não custa nada.
 */
const VIGIADAS = [
  "addons",
  "app_settings",
  "app_updates",
  "campaign_emails",
  "campaigns",
  "contract_templates",
  "email_signatures",
  "feature_flags",
  "files",
  "folders",
  "legal_documents",
  "mail_labels",
  "mailboxes",
  "message_templates",
  "plans",
  "profiles",
  "properties",
  "property_documents",
  "property_media",
  // As duas seguintes faltaram no A8 e foram encontradas pelo detetor de
  // policies abaixo, na primeira corrida (2 nov, 20261102100000).
  "saved_properties",
  "scheduled_sends",
  "search_alerts",
  "seo_pages",
  "site_leads",
  "staff_auth",
  "staff_members",
  "subscription_addons",
  "subscriptions",
  "tickets",
  "trial_extension_requests",
] as const;

function semComentarios(texto: string): string {
  return texto
    .split("\n")
    .map((linha) => {
      let dentroDeString = false;
      for (let i = 0; i < linha.length; i++) {
        const c = linha[i];
        if (c === "'") dentroDeString = !dentroDeString;
        else if (!dentroDeString && c === "-" && linha[i + 1] === "-") return linha.slice(0, i);
      }
      return linha;
    })
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Estado dos triggers depois de aplicar todas as migrações por ordem: um
 * `drop trigger` posterior apaga o que um `create trigger` anterior criou.
 * Devolve `tabela → funções de trigger ativas`.
 */
function triggersAtivos(sqls: string[]): Map<string, Set<string>> {
  const porNome = new Map<string, { tabela: string; funcao: string }>();
  for (const sql of sqls) {
    const eventos = [
      ...[
        ...sql.matchAll(
          /create\s+trigger\s+(\w+)[\s\S]*?\bon\s+public\.(\w+)[\s\S]*?execute\s+function\s+public\.(\w+)/gi,
        ),
      ].map((m) => ({ i: m.index!, tipo: "+", nome: m[1]!, tabela: m[2]!, funcao: m[3]! })),
      ...[...sql.matchAll(/drop\s+trigger\s+(?:if\s+exists\s+)?(\w+)\s+on\s+public\.(\w+)/gi)].map(
        (m) => ({ i: m.index!, tipo: "-", nome: m[1]!, tabela: m[2]!, funcao: "" }),
      ),
    ].sort((a, b) => a.i - b.i);
    for (const e of eventos) {
      const chave = `${e.tabela}.${e.nome}`;
      if (e.tipo === "+") porNome.set(chave, { tabela: e.tabela, funcao: e.funcao });
      else porNome.delete(chave);
    }
  }
  const out = new Map<string, Set<string>>();
  for (const [chave, { tabela, funcao }] of porNome) {
    if (!out.has(tabela)) out.set(tabela, new Set());
    out.get(tabela)!.add(funcao);
    // O nome também conta: uma tabela pode ter dois triggers com a mesma
    // função (o guarda por linha e o do `truncate`), e perder um deles é
    // perder metade do guarda.
    out.get(tabela)!.add(`trigger:${chave.split(".")[1]}`);
  }
  return out;
}

/**
 * Tabelas em que o staff pode **escrever** por RLS, lidas das migrações
 * ---------------------------------------------------------------------------
 * A regra "tabela nova em que o staff escreve ⇒ trigger de auditoria" não
 * pode depender de alguém se lembrar (2 nov 2026, pedido do cliente: que
 * fique documentada — e, melhor do que documentada, verificada). Este
 * detetor reconstrói as policies em vigor, pela ordem das migrações, e
 * devolve as tabelas que têm uma policy de escrita (`insert`, `update`,
 * `delete` ou `all`) que menciona um papel de staff.
 *
 * Não vê tudo: uma tabela que o staff só altera por RPC `security definer`
 * não tem policy de escrita nenhuma. Essas entram em `VIGIADAS` à mão — e a
 * regra está escrita no cabeçalho da migração do A8 e na §28 do doc 12.
 */
const PAPEL_DE_STAFF =
  /\b(is_staff|is_admin|is_support|is_marketing|is_internal|staff_sees_mailbox)\s*\(/i;

function tabelasComEscritaDeStaff(sqls: string[]): Set<string> {
  const vivas = new Map<string, { tabela: string; escreve: boolean }>();
  for (const sql of sqls) {
    const eventos = [
      ...[...sql.matchAll(/create\s+policy\s+"?(\w+)"?\s+on\s+public\.(\w+)([\s\S]*?);/gi)].map(
        (m) => {
          const corpo = m[3]!;
          const cmd = (
            /\bfor\s+(all|select|insert|update|delete)\b/i.exec(corpo)?.[1] ?? "all"
          ).toLowerCase();
          return {
            i: m.index!,
            tipo: "+",
            chave: `${m[2]}.${m[1]}`,
            tabela: m[2]!,
            escreve: cmd !== "select" && PAPEL_DE_STAFF.test(corpo),
          };
        },
      ),
      ...[
        ...sql.matchAll(/drop\s+policy\s+(?:if\s+exists\s+)?"?(\w+)"?\s+on\s+public\.(\w+)/gi),
      ].map((m) => ({
        i: m.index!,
        tipo: "-",
        chave: `${m[2]}.${m[1]}`,
        tabela: m[2]!,
        escreve: false,
      })),
    ].sort((a, b) => a.i - b.i);
    for (const e of eventos) {
      if (e.tipo === "+") vivas.set(e.chave, { tabela: e.tabela, escreve: e.escreve });
      else vivas.delete(e.chave);
    }
  }
  return new Set([...vivas.values()].filter((p) => p.escreve).map((p) => p.tabela));
}

/** Os guardas append-only, pelo nome: os dois de cada tabela de auditoria. */
const GUARDAS = {
  audit_log: ["audit_log_append_only", "audit_log_append_only_truncate"],
  personal_data_access_log: [
    "personal_data_access_log_append_only",
    "personal_data_access_log_append_only_truncate",
  ],
} as const;

const sqls = readdirSync(MIGRACOES)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => semComentarios(readFileSync(join(MIGRACOES, f), "utf8")));
const ativos = triggersAtivos(sqls);

describe("A8 · auditoria — o que as migrações deixam montado", () => {
  it("as duas tabelas de auditoria têm os dois guardas append-only", () => {
    const faltam = Object.entries(GUARDAS).flatMap(([tabela, nomes]) =>
      nomes.filter((nome) => !ativos.get(tabela)?.has(`trigger:${nome}`)),
    );
    expect(faltam).toEqual([]);
  });

  it("toda a tabela vigiada tem o trigger de auditoria de staff", () => {
    const sem = VIGIADAS.filter((t) => !ativos.get(t)?.has("audit_staff_write"));
    expect(sem).toEqual([]);
  });

  it("toda a tabela em que o staff pode escrever por RLS está vigiada", () => {
    // Se isto falhar depois de uma migração nova: a tabela da mensagem tem uma
    // policy de escrita para staff e não tem o trigger. Acrescentar o
    // `create trigger ... execute function public.audit_staff_write()` numa
    // migração e o nome a `VIGIADAS`. Não se tira daqui sem decisão escrita.
    const vigiadas = new Set<string>(VIGIADAS);
    const porVigiar = [...tabelasComEscritaDeStaff(sqls)].filter((t) => !vigiadas.has(t)).sort();
    expect(porVigiar).toEqual([]);
  });

  it("o detetor de policies vê uma tabela nova, e esquece uma policy apagada", () => {
    const nova =
      "create policy nova_staff_write on public.nova for update using (public.is_admin()) with check (public.is_admin());";
    const leitura =
      "create policy nova_select on public.leitura for select using (public.is_staff());";
    const dono = "create policy dono_write on public.dono for all using (owner_id = auth.uid());";
    expect([...tabelasComEscritaDeStaff([nova, leitura, dono])]).toEqual(["nova"]);
    expect([
      ...tabelasComEscritaDeStaff([nova, "drop policy if exists nova_staff_write on public.nova;"]),
    ]).toEqual([]);
  });

  it("o detetor vê um trigger que uma migração posterior apagou", () => {
    const antes =
      "create trigger x_audit after insert on public.x for each row execute function public.audit_staff_write();";
    const depois = "drop trigger if exists x_audit on public.x;";
    expect(triggersAtivos([antes]).get("x")?.has("audit_staff_write")).toBe(true);
    expect(triggersAtivos([antes, depois]).get("x")?.has("audit_staff_write") ?? false).toBe(false);
  });

  it("a função de trigger guarda nomes de colunas, nunca valores", () => {
    // `create or replace` e não só `function`: um `execute function
    // public.audit_staff_write()` noutra migração também casava, e o teste
    // passava a ler um `create trigger` em vez da função (2 nov).
    const definicao = /create\s+or\s+replace\s+function\s+public\.audit_staff_write\(/i;
    const sql = [...sqls].reverse().find((s) => definicao.test(s))!;
    const corpo = sql.slice(sql.search(definicao));
    const ate = corpo.slice(0, corpo.indexOf("$$;", corpo.indexOf("$$") + 2));
    expect(ate).toContain("'changed', to_jsonb(v_changed)");
    // Nenhum `to_jsonb(new)`/`v_new` inteiro vai parar ao `diff`.
    expect(ate).not.toMatch(/'(before|after|new|old)'\s*,\s*v_(new|old)/);
  });
});

// ---------------------------------------------------------------------------
// Comportamental — contra a base
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasEnv = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

const PASSWORD = "audit-a8-test-P@ss1";
const USERS = {
  admin: { email: "audit-a8-admin@upropertymarket.test", role: "admin" },
  buyer: { email: "audit-a8-buyer@upropertymarket.test", role: "buyer" },
} as const;

describe.skipIf(!hasEnv)("A8 · auditoria — contra a base", () => {
  let service: SupabaseClient;
  const clients = {} as Record<keyof typeof USERS, SupabaseClient>;
  const ids = {} as Record<keyof typeof USERS, string>;

  async function getOrCreate(email: string, role: string) {
    const { data } = await listarTodosOsUtilizadores(service);
    const found = data.users.find((u) => u.email === email);
    if (found) return found.id;
    const created = await service.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { role },
    });
    if (created.error || !created.data.user) throw new Error(`Falha a criar ${email}`);
    // O trigger só aceita buyer/owner do metadata; a equipa recebe o papel aqui.
    await service.from("profiles").update({ role }).eq("id", created.data.user.id);
    return created.data.user.id;
  }

  beforeAll(async () => {
    service = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);
    for (const key of Object.keys(USERS) as (keyof typeof USERS)[]) {
      ids[key] = await getOrCreate(USERS[key].email, USERS[key].role);
      const client = createClient(SUPABASE_URL!, ANON_KEY!);
      const { error } = await client.auth.signInWithPassword({
        email: USERS[key].email,
        password: PASSWORD,
      });
      if (error) throw new Error(`Falha a autenticar ${USERS[key].email}: ${error.message}`);
      clients[key] = client;
    }
  });

  afterAll(async () => {
    await service.from("contract_templates").delete().like("name", "A8 teste %");
  });

  it("a service_role não altera nem apaga uma linha de audit_log", async () => {
    const { data: row } = await service
      .from("audit_log")
      .select("id, action")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(row).not.toBeNull();

    const upd = await service.from("audit_log").update({ action: "reescrito" }).eq("id", row!.id);
    expect(upd.error?.message ?? "").toContain("só de acrescentar");

    const del = await service.from("audit_log").delete().eq("id", row!.id);
    expect(del.error?.message ?? "").toContain("só de acrescentar");

    const { data: depois } = await service
      .from("audit_log")
      .select("action")
      .eq("id", row!.id)
      .single();
    expect(depois?.action).toBe(row!.action);
  });

  it("a service_role não apaga personal_data_access_log", async () => {
    const { data: row } = await service
      .from("personal_data_access_log")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!row) return; // tabela vazia: nada a tentar, e o guarda está provado no estático
    const del = await service.from("personal_data_access_log").delete().eq("id", row.id);
    expect(del.error?.message ?? "").toContain("só de acrescentar");
  });

  it("uma escrita de staff fica registada, com as colunas e sem os valores", async () => {
    const familyId = crypto.randomUUID();
    const { data: tpl, error } = await clients.admin
      .from("contract_templates")
      .insert({ family_id: familyId, kind: "sale", name: "A8 teste inserção" })
      .select("id")
      .single();
    expect(error).toBeNull();

    await clients.admin
      .from("contract_templates")
      .update({ name: "A8 teste renomeado" })
      .eq("id", tpl!.id);

    const { data: rows } = await service
      .from("audit_log")
      .select("action, actor_id, diff")
      .eq("entity_id", tpl!.id)
      .order("created_at");
    const acoes = (rows ?? []).map((r) => r.action);
    expect(acoes).toEqual(["contract_templates.insert", "contract_templates.update"]);
    expect(rows!.every((r) => r.actor_id === ids.admin)).toBe(true);

    const update = rows![1]!.diff as { changed: string[] };
    expect(update.changed).toEqual(["name"]);
    // O valor novo não está no rasto — só o nome da coluna.
    expect(JSON.stringify(rows)).not.toContain("renomeado");
  });

  it("a escrita de um cliente no que é seu não é auditada como staff", async () => {
    const { count: before } = await service
      .from("audit_log")
      .select("id", { count: "exact", head: true })
      .eq("actor_id", ids.buyer);
    await clients.buyer.from("profiles").update({ theme: "dark" }).eq("id", ids.buyer);
    await clients.buyer.from("profiles").update({ theme: "light" }).eq("id", ids.buyer);
    const { count: after } = await service
      .from("audit_log")
      .select("id", { count: "exact", head: true })
      .eq("actor_id", ids.buyer);
    expect(before).not.toBeNull();
    expect(after).toBe(before);
  });

  it("record_staff_read: regista, deduplica 15 min, e recusa o desconhecido e o cliente", async () => {
    const entity = crypto.randomUUID();
    const first = await clients.admin.rpc("record_staff_read", {
      p_action: "mailbox.opened",
      p_entity: "mailboxes",
      p_entity_id: entity,
    });
    expect(first.error).toBeNull();
    expect(first.data).toBe(true);

    const again = await clients.admin.rpc("record_staff_read", {
      p_action: "mailbox.opened",
      p_entity: "mailboxes",
      p_entity_id: entity,
    });
    expect(again.data).toBe(false);

    const unknown = await clients.admin.rpc("record_staff_read", {
      p_action: "qualquer.coisa",
      p_entity: "x",
    });
    expect(unknown.error).not.toBeNull();

    const byBuyer = await clients.buyer.rpc("record_staff_read", {
      p_action: "report.exported",
      p_entity: "campaign_report",
    });
    expect(byBuyer.error).not.toBeNull();
  });

  it("run_retention continua sem erros, com a purga das consultas incluída", async () => {
    const { data, error } = await service.rpc("run_retention");
    expect(error).toBeNull();
    const result = data as { counts: Record<string, number>; errors: Record<string, string> };
    expect(result.errors).toEqual({});
    expect(result.counts).toHaveProperty("purge_personal_data_access_log");
    expect(result.counts).toHaveProperty("purge_audit_log");
  });

  it("apagar uma conta com rasto continua a funcionar: o autor passa a null", async () => {
    const email = `audit-a8-temp-${Date.now()}@upropertymarket.test`;
    const created = await service.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { role: "admin" },
    });
    const tempId = created.data.user!.id;
    await service.from("profiles").update({ role: "admin" }).eq("id", tempId);
    const temp = createClient(SUPABASE_URL!, ANON_KEY!);
    await temp.auth.signInWithPassword({ email, password: PASSWORD });

    const { data: tpl } = await temp
      .from("contract_templates")
      .insert({ family_id: crypto.randomUUID(), kind: "rent", name: "A8 teste conta temporária" })
      .select("id")
      .single();

    const removed = await service.auth.admin.deleteUser(tempId);
    expect(removed.error).toBeNull();

    const { data: rows } = await service
      .from("audit_log")
      .select("actor_id")
      .eq("entity_id", tpl!.id);
    expect((rows ?? []).length).toBeGreaterThan(0);
    expect(rows!.every((r) => r.actor_id === null)).toBe(true);
  });

  // A saída da equipa (8 nov 2026, 20261108090000): quem abriu dados de
  // alguém ficava preso pelo `personal_data_access_log` (`restrict`) e não se
  // eliminava. Agora a conta sai; a consulta fica, sem autor, e continua a
  // não se poder reescrever.
  it("uma conta da equipa que consultou dados elimina-se: a consulta fica, sem autor", async () => {
    const email = `audit-saida-${Date.now()}@upropertymarket.test`;
    const created = await service.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { role: "admin" },
    });
    const tempId = created.data.user!.id;
    await service.from("profiles").update({ role: "admin" }).eq("id", tempId);
    const subject = crypto.randomUUID();
    const { data: row, error: insertError } = await service
      .from("personal_data_access_log")
      .insert({
        actor_profile_id: tempId,
        subject_type: "profile",
        subject_id: subject,
        action: "view",
      })
      .select("id")
      .single();
    expect(insertError).toBeNull();

    const removed = await service.auth.admin.deleteUser(tempId);
    expect(removed.error).toBeNull();

    const { data: after } = await service
      .from("personal_data_access_log")
      .select("actor_profile_id, subject_id")
      .eq("id", row!.id)
      .single();
    expect(after).toEqual({ actor_profile_id: null, subject_id: subject });

    // A exceção do trigger é só o autor a null: mexer no resto recusa-se.
    const rewrite = await service
      .from("personal_data_access_log")
      .update({ subject_id: crypto.randomUUID() })
      .eq("id", row!.id);
    expect(rewrite.error).not.toBeNull();
  });
});
