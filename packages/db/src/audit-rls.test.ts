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

const MIGRACOES = fileURLToPath(new URL("../../../supabase/migrations", import.meta.url));

/**
 * As tabelas que o staff altera e que, por isso, têm de ter o trigger. Tirar
 * uma daqui é uma decisão de deixar de auditar essa área — tem de se ver no
 * diff deste ficheiro, não acontecer por omissão numa migração.
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
  "scheduled_sends",
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

  it("o detetor vê um trigger que uma migração posterior apagou", () => {
    const antes =
      "create trigger x_audit after insert on public.x for each row execute function public.audit_staff_write();";
    const depois = "drop trigger if exists x_audit on public.x;";
    expect(triggersAtivos([antes]).get("x")?.has("audit_staff_write")).toBe(true);
    expect(triggersAtivos([antes, depois]).get("x")?.has("audit_staff_write") ?? false).toBe(false);
  });

  it("a função de trigger guarda nomes de colunas, nunca valores", () => {
    const sql = [...sqls].reverse().find((s) => /function\s+public\.audit_staff_write\(/i.test(s))!;
    const corpo = sql.slice(sql.search(/function\s+public\.audit_staff_write\(/i));
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
    const { data } = await service.auth.admin.listUsers();
    const found = data.users.find((u) => u.email === email);
    if (found) return found.id;
    const created = await service.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { role },
    });
    if (created.error || !created.data.user) throw new Error(`Falha a criar ${email}`);
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
});
