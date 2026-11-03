/**
 * A15 — o que a chave pública alcança (12 §30)
 * =========================================================================
 * A chave `anon` vai no browser de toda a gente. Até 2 nov, o `anon` tinha
 * `execute` em 100 funções `security definer`, 39 sem guarda de identidade:
 * notificar qualquer pessoa, fazer downgrade de qualquer plano, trancar a
 * entrada de outra conta, disparar os jobs. Este teste existe para não voltar.
 *
 * Duas partes:
 *
 *  - **Estática (corre no CI):** depois da migração A15, os privilégios por
 *    omissão já não dão nada ao `anon` — uma função nova só lhe chega por um
 *    `grant ... to anon` escrito. Qualquer `grant` desses a uma função fora
 *    de `ANON_PERMITIDAS` parte o CI, com o nome dela na mensagem.
 *  - **Ao vivo (com credenciais):** o catálogo real, por `security_surface()`,
 *    tem de bater com a lista; as internas não podem estar ao alcance de uma
 *    sessão; e as chamadas que a 2 nov passavam passam a ser recusadas.
 *
 * Acrescentar uma função a `ANON_PERMITIDAS` é uma decisão de segurança: a
 * pergunta é "um estranho, sem conta, precisa disto — e o que impede que a
 * use contra outra pessoa?". A resposta vai no comentário ao lado.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

const MIGRACOES = fileURLToPath(new URL("../../../supabase/migrations", import.meta.url));
const A15 = "20261102110000_superficie_anon.sql";
const A15_GLOBAL = "20261103100000_superficie_anon_public_global.sql";

/** O que um visitante sem conta pode executar. A mesma lista está na migração A15. */
export const ANON_PERMITIDAS = new Map<string, string>([
  ["submit_site_lead", "formulários do site; honeypot e limite por IP lá dentro"],
  ["confirm_site_lead", "confirmação por token de uso único"],
  ["campaign_unsubscribe", "link de cancelamento do e-mail, por token"],
  ["listing_availability", "só revela o que já foi público (vendido vs. nunca existiu)"],
  ["current_legal_document", "Termos e Privacidade, públicos por natureza"],
  ["resolve_file_share", "link de partilha: token, expiração, código e tentativas"],
  ["resolve_contract_share", "o mesmo, para contratos"],
  ["is_admin", "policies avaliadas também para o `anon` (devolve false)"],
  ["is_internal", "idem"],
  ["is_marketing", "idem"],
  ["is_staff", "idem"],
  ["is_support", "idem"],
]);

/** Sem `anon` e sem `authenticated`: só pg_cron, triggers, outras funções ou `service_role`. */
const INTERNAS = [
  "notify",
  "upsert_owner_lead",
  "apply_plan_downgrade",
  "record_subscription_agreement",
  "check_auth_rate_limit",
  "record_auth_attempt",
  "complete_due_visits",
  "run_search_alerts",
  "purge_cloud_recycle_bin",
  "purge_document_access_log",
  "purge_property_view_events",
  "purge_ticket_technical_data",
  "purge_cron_job_run_details",
  "run_retention",
  "security_surface",
  "role_of",
  "effective_limits",
  "plan_usage",
  "plan_limit_exceeded",
  "cloud_usage_bytes",
  "cloud_limit_bytes",
  "account_blocked",
  "suggest_ticket_severity",
] as const;

// ---------------------------------------------------------------------------
// Estática — as migrações
// ---------------------------------------------------------------------------

/** Os `grant execute on function X(...) to ..., anon` de um texto SQL. */
export function grantsAoAnon(sql: string): string[] {
  const semComentarios = sql.replace(/--[^\n]*/g, "");
  const nomes: string[] = [];
  const re =
    /grant\s+(?:execute|all)(?:\s+privileges)?\s+on\s+function\s+(?:public\.)?([a-z_0-9]+)\s*\([^;]*?\)\s+to\s+([^;]+);/gi;
  for (const m of semComentarios.matchAll(re)) {
    if (/\b(anon|public)\b/i.test(m[2]!)) nomes.push(m[1]!.toLowerCase());
  }
  return nomes;
}

/** Algum `alter default privileges` que volte a dar funções ao `anon`/`public`? */
export function devolveOmissaoAoAnon(sql: string): boolean {
  const semComentarios = sql.replace(/--[^\n]*/g, "");
  return /alter\s+default\s+privileges[^;]*grant\s+[^;]*on\s+functions\s+to\s+[^;]*\b(anon|public)\b/i.test(
    semComentarios,
  );
}

describe("A15 · superfície do anon — estática", () => {
  it("o detetor apanha um grant ao anon, e ignora os outros (teste negativo)", () => {
    const plantado = `
      create function public.vazar() returns void language sql security definer as $$ select 1 $$;
      grant execute on function public.vazar() to anon, authenticated;
      grant execute on function public.so_servidor(uuid) to service_role;
      -- grant execute on function public.comentada() to anon;
      grant all on function public.tudo(text, int) to public;
    `;
    expect(grantsAoAnon(plantado)).toEqual(["vazar", "tudo"]);
    expect(
      devolveOmissaoAoAnon(
        "alter default privileges in schema public grant execute on functions to anon;",
      ),
    ).toBe(true);
    expect(
      devolveOmissaoAoAnon(
        "alter default privileges for role postgres in schema public revoke execute on functions from public, anon;",
      ),
    ).toBe(false);
  });

  it("a migração A15 tira o anon e o public dos privilégios por omissão", () => {
    const sql = readFileSync(join(MIGRACOES, A15), "utf8");
    expect(sql).toMatch(
      /alter default privileges for role postgres in schema public\s+revoke execute on functions from public, anon;/,
    );
    for (const nome of ANON_PERMITIDAS.keys()) expect(sql).toContain(`'${nome}'`);
    // A regra por esquema não chega: o `execute` de PUBLIC sobre funções é
    // uma omissão global, e só sai sem `in schema`. Foi o teste negativo de
    // 3 nov (uma função criada e desfeita numa transação) que o mostrou.
    const global = readFileSync(join(MIGRACOES, A15_GLOBAL), "utf8").replace(/--[^\n]*/g, "");
    expect(global).toMatch(
      /alter default privileges for role postgres\s+revoke execute on functions from public;/,
    );
  });

  it("desde a A15, nenhuma migração dá ao anon uma função fora da lista", () => {
    const depois = readdirSync(MIGRACOES)
      .filter((f) => f.endsWith(".sql") && f >= A15)
      .sort();
    const ofensas: string[] = [];
    for (const ficheiro of depois) {
      const sql = readFileSync(join(MIGRACOES, ficheiro), "utf8");
      for (const nome of grantsAoAnon(sql)) {
        if (!ANON_PERMITIDAS.has(nome)) ofensas.push(`${ficheiro}: ${nome}`);
      }
      if (devolveOmissaoAoAnon(sql))
        ofensas.push(`${ficheiro}: alter default privileges ... to anon`);
    }
    expect(
      ofensas,
      "Função nova ao alcance da chave pública. Se um visitante sem conta precisa mesmo dela, " +
        "acrescenta-a a ANON_PERMITIDAS com a razão; senão, tira o grant ao anon.",
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Ao vivo — o catálogo real
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasEnv = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

type Superficie = {
  name: string;
  security_definer: boolean;
  anon_execute: boolean;
  authenticated_execute: boolean;
  is_trigger: boolean;
};

const ZERO = "00000000-0000-0000-0000-000000000000";

describe.skipIf(!hasEnv)("A15 · superfície do anon — contra staging", () => {
  let service: SupabaseClient;
  let anon: SupabaseClient;
  let superficie: Superficie[] = [];

  beforeAll(async () => {
    service = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);
    anon = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } });
    const { data, error } = await service.rpc("security_surface");
    if (error) throw new Error(`security_surface: ${error.message}`);
    superficie = data as Superficie[];
  });

  it("o anon só executa as security definer da lista", () => {
    const fora = superficie
      .filter((f) => f.security_definer && !f.is_trigger && f.anon_execute)
      .map((f) => f.name)
      .filter((nome) => !ANON_PERMITIDAS.has(nome));
    expect(fora, "security definer ao alcance da chave pública, fora de ANON_PERMITIDAS").toEqual(
      [],
    );
  });

  it("as internas não estão ao alcance de nenhuma sessão", () => {
    const abertas = superficie
      .filter((f) => (INTERNAS as readonly string[]).includes(f.name))
      .filter((f) => f.anon_execute || f.authenticated_execute)
      .map((f) => f.name);
    expect(abertas).toEqual([]);
    // E existem: uma lista de nomes que já não existem não protege nada.
    const existentes = new Set(superficie.map((f) => f.name));
    expect(INTERNAS.filter((n) => !existentes.has(n))).toEqual([]);
  });

  it("as chamadas que a 2 nov passavam com a chave pública são recusadas", async () => {
    const tentativas: Array<[string, Record<string, unknown>]> = [
      [
        "notify",
        {
          p_profile_id: ZERO,
          p_type: "x",
          p_title: "x",
          p_body: "x",
          p_link: null,
          p_group_key: null,
        },
      ],
      ["apply_plan_downgrade", { p_profile_id: ZERO }],
      [
        "record_auth_attempt",
        { p_identifier: "alheio@example.com", p_kind: "login", p_succeeded: false },
      ],
      ["run_search_alerts", {}],
      ["complete_due_visits", {}],
      ["purge_property_view_events", {}],
      ["role_of", { uid: ZERO }],
      ["effective_limits", { p_profile_id: ZERO }],
      // Nasceu depois da A15, com `grant` só ao `authenticated`.
      ["my_owned_property_views_daily", { p_days: 30 }],
    ];
    const passaram: string[] = [];
    for (const [nome, args] of tentativas) {
      const { error } = await anon.rpc(nome, args);
      if (!error) passaram.push(nome);
    }
    expect(passaram).toEqual([]);
  });

  it("o que o site precisa continua a responder ao anon", async () => {
    const { error } = await anon.rpc("listing_availability", { p_property_id: ZERO });
    expect(error).toBeNull();
    const { error: erroIs } = await anon.rpc("is_staff");
    expect(erroIs).toBeNull();
  });
});
