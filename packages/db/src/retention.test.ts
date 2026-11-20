/**
 * A7 · retenção por tabela (12 §14 #2, §25) — RGPD art. 5.º(1)(e).
 *
 * Duas metades, porque a migração não se consegue aplicar aqui (sem Docker,
 * sem `supabase start`) e o que se prova sem base de dados tem de se provar
 * sem ela:
 *
 *  1. **Estática, corre sempre.** Lê as migrações e afirma as três coisas que
 *     mais custam se falharem:
 *       - nenhuma migração apaga ou trunca uma tabela com retenção legal
 *         mínima (faturação: 10 anos, Código Comercial e CIVA) — num item
 *         cujo instinto é "apagar o que é velho", é o engano mais caro;
 *       - cada purga tem o prazo decidido, nem mais nem menos;
 *       - cada purga é `security definer` com `search_path = ''` e só a
 *         `service_role` a chama.
 *     Cada detetor tem o seu teste negativo: um portão só se confia depois de
 *     o ver falhar (12 §0).
 *  2. **Comportamental, contra staging.** Salta sem credenciais (D13), e só
 *     passa depois de a migração subir — antes disso as funções não existem.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listarTodosOsUtilizadores } from "./test-users";

const MIGRACOES = fileURLToPath(new URL("../../../supabase/migrations", import.meta.url));
const RETENCAO = "20261101090000_retencao_por_tabela.sql";

/**
 * Tabelas que nenhuma migração pode esvaziar.
 *
 * `profiles` está aqui por outro caminho: não tem retenção legal própria, mas
 * `invoices.profile_id` e `subscriptions.profile_id` são `on delete cascade`.
 * Um `delete from profiles` apagava a faturação por arrasto — por isso a conta
 * eliminada anonimiza-se e não se apaga (P9-06).
 */
const PROTEGIDAS = [
  "invoices",
  "subscriptions",
  "subscription_events",
  "subscription_agreements",
  "subscription_addons",
  "stripe_events",
  "terms_acceptances",
  "email_suppressions",
  "account_deletions",
  "person_identities",
  "profiles",
] as const;

/**
 * Os prazos decididos (cliente, 1 nov 2026, contra o art. 5.º(1)(e)). Mudar um
 * valor aqui sem mudar a migração — ou o contrário — parte o teste, que é o
 * objetivo: o prazo é uma decisão, não um detalhe de implementação.
 */
const PRAZOS: Record<string, string> = {
  purge_stale_site_leads: "12 months",
  purge_notification_deliveries: "90 days",
  purge_auth_attempts: "90 days",
  purge_audit_log: "24 months",
  purge_mail_messages: "24 months",
  purge_deleted_account_residue: "30 days",
  // 07 §13.6, desde a Fase 8; passou a função (e ao orquestrador) no A8.
  purge_personal_data_access_log: "2 years",
  // A15 (2 nov): o histórico do pg_cron não se purgava, e o job de cada
  // minuto acrescenta ~10 mil linhas por semana.
  purge_cron_job_run_details: "30 days",
};

/** Apaga comentários `--` e `/* *\/`, como o `gate:rls`: a prosa cita SQL. */
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

/** `delete from`/`truncate` sobre uma tabela protegida, já sem comentários. */
function apagamentosProtegidos(sql: string): string[] {
  const nomes = PROTEGIDAS.join("|");
  const regex = new RegExp(
    `\\b(?:delete\\s+from|truncate(?:\\s+table)?)\\s+(?:only\\s+)?(?:public\\.)?"?(${nomes})"?\\b`,
    "gi",
  );
  return [...sql.matchAll(regex)].map((m) => m[1]!.toLowerCase());
}

/** Cabeçalho (até `as $$`) e corpo de `public.<nome>()`, ou null. */
function funcao(sql: string, nome: string): { cabecalho: string; corpo: string } | null {
  const m = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+public\\.${nome}\\(\\)([\\s\\S]*?)\\bas\\s+\\$\\$([\\s\\S]*?)\\$\\$;`,
    "i",
  ).exec(sql);
  return m ? { cabecalho: m[1]!, corpo: m[2]! } : null;
}

/** O que falta a uma purga para ser fechada. Vazio = está bem. */
function defeitosDeFecho(sql: string, nome: string): string[] {
  const f = funcao(sql, nome);
  if (!f) return ["função inexistente"];
  const defeitos: string[] = [];
  if (!/security\s+definer/i.test(f.cabecalho)) defeitos.push("sem security definer");
  if (!/set\s+search_path\s*=\s*''/i.test(f.cabecalho)) defeitos.push("search_path não é ''");
  const revoke = new RegExp(
    `revoke\\s+all\\s+on\\s+function\\s+public\\.${nome}\\(\\)\\s+from\\s+public,\\s*anon,\\s*authenticated;`,
    "i",
  );
  if (!revoke.test(sql)) defeitos.push("execute não revogado a public/anon/authenticated");
  const grant = new RegExp(
    `grant\\s+execute\\s+on\\s+function\\s+public\\.${nome}\\(\\)\\s+to\\s+service_role;`,
    "i",
  );
  if (!grant.test(sql)) defeitos.push("sem grant à service_role");
  return defeitos;
}

/** Os intervalos literais no corpo da função, normalizados. */
function intervalos(corpo: string): string[] {
  return [...corpo.matchAll(/interval\s+'([^']+)'/gi)].map((m) => m[1]!.trim().toLowerCase());
}

const ficheiros = readdirSync(MIGRACOES)
  .filter((f) => f.endsWith(".sql"))
  .sort();
const migracao = semComentarios(readFileSync(join(MIGRACOES, RETENCAO), "utf8"));
const sqls = ficheiros.map((ficheiro) => ({
  ficheiro,
  sql: semComentarios(readFileSync(join(MIGRACOES, ficheiro), "utf8")),
}));

/**
 * O SQL do ficheiro que define `nome` **por último** — a versão que está em
 * vigor. O A8 (2 nov) redefiniu `purge_audit_log` e `run_retention`; ler só
 * o ficheiro do A7 era testar uma função que já não existe.
 */
function vigente(nome: string): string {
  const ultimo = [...sqls].reverse().find(({ sql }) => funcao(sql, nome) !== null);
  return ultimo?.sql ?? "";
}

describe("A7 · retenção — o que nunca se apaga", () => {
  it("nenhuma migração faz delete ou truncate de uma tabela com retenção legal", () => {
    const achados = ficheiros.flatMap((ficheiro) => {
      const sql = semComentarios(readFileSync(join(MIGRACOES, ficheiro), "utf8"));
      return apagamentosProtegidos(sql).map((tabela) => `${ficheiro}: ${tabela}`);
    });
    expect(achados).toEqual([]);
  });

  it("o detetor apanha o engano, com e sem esquema, e ignora a prosa", () => {
    expect(apagamentosProtegidos("delete from public.invoices where issued_at < now();")).toEqual([
      "invoices",
    ]);
    expect(apagamentosProtegidos("DELETE FROM subscription_events;")).toEqual([
      "subscription_events",
    ]);
    expect(apagamentosProtegidos("truncate table only public.profiles;")).toEqual(["profiles"]);
    // A prosa da própria migração fala de apagar faturas — sem comentários, cala.
    expect(
      apagamentosProtegidos(semComentarios("-- delete from public.invoices\nselect 1;")),
    ).toEqual([]);
    // E não confunde uma tabela de nome parecido.
    expect(apagamentosProtegidos("delete from public.invoices_draft;")).toEqual([]);
  });
});

describe("A7 · retenção — os prazos e o fecho de cada purga", () => {
  for (const [nome, prazo] of Object.entries(PRAZOS)) {
    it(`${nome}: prazo de ${prazo}`, () => {
      const f = funcao(vigente(nome), nome);
      expect(f, `${nome} não está definida em migração nenhuma`).not.toBeNull();
      expect(intervalos(f!.corpo)).toEqual([prazo]);
    });

    it(`${nome}: security definer, search_path vazio, só service_role`, () => {
      expect(defeitosDeFecho(vigente(nome), nome)).toEqual([]);
    });
  }

  it("o detetor de fecho recusa uma purga aberta", () => {
    const aberta = `
      create or replace function public.purge_x()
      returns integer language plpgsql security definer set search_path = public
      as $$ begin return 0; end; $$;
      revoke all on function public.purge_x() from public, anon;`;
    expect(defeitosDeFecho(aberta, "purge_x")).toEqual([
      "search_path não é ''",
      "execute não revogado a public/anon/authenticated",
      "sem grant à service_role",
    ]);
    expect(defeitosDeFecho(aberta, "purge_y")).toEqual(["função inexistente"]);
  });

  it("o detetor de prazo vê um prazo trocado", () => {
    const f = funcao(
      "create or replace function public.p() returns int as $$ select interval '9 days'; $$;",
      "p",
    );
    expect(intervalos(f!.corpo)).not.toEqual(["90 days"]);
  });
});

describe("A7 · retenção — o orquestrador", () => {
  const run = funcao(vigente("run_retention"), "run_retention");

  it("chama todas as purgas novas, cada uma no seu bloco com exception", () => {
    expect(run).not.toBeNull();
    for (const nome of Object.keys(PRAZOS)) {
      expect(run!.corpo, nome).toContain(`v_n := public.${nome}()`);
    }
    // Um bloco por purga: uma que falha não leva as outras (o defeito de 7 out).
    expect(run!.corpo).toMatch(/exception\s+when\s+others\s+then/i);
    expect(defeitosDeFecho(vigente("run_retention"), "run_retention")).toEqual([]);
  });

  it("deixa prova em audit_log e está agendado no pg_cron", () => {
    expect(run!.corpo).toMatch(/insert\s+into\s+public\.audit_log/i);
    expect(run!.corpo).toContain("'retention.run'");
    expect(migracao).toMatch(/cron\.schedule\(\s*'upm-run-retention',\s*'10 3 \* \* \*'/);
  });

  it("a purga do audit_log poupa a faturação", () => {
    const corpo = funcao(vigente("purge_audit_log"), "purge_audit_log")!.corpo;
    for (const entidade of ["invoices", "subscriptions", "subscription_events"]) {
      expect(corpo).toContain(`'${entidade}'`);
    }
    expect(corpo).toContain("not like 'stripe.%'");
  });

  it("a purga do correio não abandona anexos ainda em Storage", () => {
    const corpo = funcao(vigente("purge_mail_messages"), "purge_mail_messages")!.corpo;
    expect(corpo).toMatch(/not\s+exists\s*\([\s\S]*?->>\s*'path'\s+is\s+not\s+null/i);
  });

  // 20 nov 2026: a pré-inscrição deixou de confirmar por e-mail, e a purga
  // dos 30 dias apagava as pessoas a avisar no lançamento.
  it("a purga das pré-inscrições por confirmar saiu, com o job", () => {
    const saida = sqls.findIndex(({ sql }) =>
      sql.includes("drop function if exists public.purge_unconfirmed_site_leads()"),
    );
    expect(saida, "falta a migração que retira a purga").toBeGreaterThan(-1);
    expect(sqls[saida]!.sql).toContain("cron.unschedule('upm-purge-unconfirmed-site-leads')");
    // Nenhuma migração posterior a volta a criar.
    const depois = sqls
      .slice(saida + 1)
      .filter(({ sql }) => funcao(sql, "purge_unconfirmed_site_leads") !== null);
    expect(depois).toEqual([]);
  });

  it("a purga de leads apaga os eventos antes dos leads (on delete restrict)", () => {
    for (const nome of ["purge_stale_site_leads"]) {
      const corpo = funcao(vigente(nome), nome)!.corpo;
      const eventos = corpo.indexOf("delete from public.site_lead_events");
      const leads = corpo.indexOf("delete from public.site_leads");
      expect(eventos, nome).toBeGreaterThan(-1);
      expect(eventos, nome).toBeLessThan(leads);
    }
  });
});

// ---------------------------------------------------------------------------
// Comportamental — contra staging
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasEnv = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

const STAMP = Date.now();
const ACTOR = "retention-actor@upropertymarket.test";
const DIA = 24 * 60 * 60 * 1000;
const haDias = (dias: number) => new Date(Date.now() - dias * DIA).toISOString();

describe.skipIf(!hasEnv)("A7 · retenção — contra staging", () => {
  let service: SupabaseClient;
  let actorId = "";
  const leads: string[] = [];

  beforeAll(async () => {
    service = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);
    const { data: users, error } = await listarTodosOsUtilizadores(service);
    if (error) throw new Error(`Falha a listar utilizadores: ${error.message}`);
    const found = users.users.find((user) => user.email === ACTOR);
    if (found) actorId = found.id;
    else {
      const { data, error: createError } = await service.auth.admin.createUser({
        email: ACTOR,
        password: "retention-test-P@ss1",
        email_confirm: true,
        user_metadata: { role: "admin" },
      });
      if (createError || !data.user) throw new Error(`Falha a criar ${ACTOR}`);
      actorId = data.user.id;
      // O trigger só aceita buyer/owner do metadata; a equipa recebe o papel aqui.
      await service.from("profiles").update({ role: "admin" }).eq("id", actorId);
    }
  });

  afterAll(async () => {
    if (leads.length === 0) return;
    await service.from("site_lead_events").delete().in("lead_id", leads);
    await service.from("site_leads").delete().in("id", leads);
  });

  async function lead(campos: Record<string, unknown>) {
    const { data, error } = await service
      .from("site_leads")
      .insert({
        source: "post_launch",
        form: "contacto",
        name: "Retenção",
        email: `retencao-${STAMP}-${leads.length}@upropertymarket.test`,
        profile_type: "buyer",
        ...campos,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`Falha a criar lead: ${error?.message}`);
    leads.push(data.id);
    return data.id as string;
  }

  it("auth_attempts: sai o de 91 dias, fica o de ontem", async () => {
    const identifier = `retencao-${STAMP}@upropertymarket.test`;
    await service.from("auth_attempts").insert([
      { identifier, kind: "login", created_at: haDias(91) },
      { identifier, kind: "login", created_at: haDias(1) },
    ]);
    const { error } = await service.rpc("purge_auth_attempts");
    expect(error).toBeNull();
    const { data } = await service
      .from("auth_attempts")
      .select("created_at")
      .eq("identifier", identifier);
    expect(data).toHaveLength(1);
    await service.from("auth_attempts").delete().eq("identifier", identifier);
  });

  it("site_leads: o velho sai com os eventos; o convertido e o recente ficam", async () => {
    // As datas vão no insert: o trigger de `updated_at` é `before update`, e
    // um update para as recuar voltava a pô-las em `now()`.
    const antigo = { created_at: haDias(400), updated_at: haDias(400), confirmed_at: haDias(400) };
    const velho = await lead(antigo);
    const convertido = await lead({ ...antigo, status: "converted" });
    const recente = await lead(antigo);
    // O evento do velho é o que fazia a purga de 7 out rebentar; o do recente
    // é de ontem, e é ele que o mantém vivo.
    await service.from("site_lead_events").insert([
      { lead_id: velho, kind: "note", body: "antigo", actor_id: actorId, created_at: haDias(400) },
      { lead_id: recente, kind: "note", body: "ontem", actor_id: actorId, created_at: haDias(1) },
    ]);

    const { error } = await service.rpc("purge_stale_site_leads");
    expect(error).toBeNull();

    const { data } = await service
      .from("site_leads")
      .select("id")
      .in("id", [velho, convertido, recente]);
    const vivos = (data ?? []).map((row) => row.id).sort();
    expect(vivos).toEqual([convertido, recente].sort());
    const { data: eventos } = await service
      .from("site_lead_events")
      .select("id")
      .eq("lead_id", velho);
    expect(eventos).toEqual([]);
  });

  it("run_retention corre tudo sem erros e deixa a linha em audit_log", async () => {
    const { data, error } = await service.rpc("run_retention");
    expect(error).toBeNull();
    expect((data as { errors: Record<string, string> }).errors).toEqual({});
    const { data: linha } = await service
      .from("audit_log")
      .select("action, diff")
      .eq("action", "retention.run")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(linha?.action).toBe("retention.run");
  });
});
