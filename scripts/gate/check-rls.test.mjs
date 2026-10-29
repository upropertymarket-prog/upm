/**
 * Teste negativo do portão da cerca do Postgres.
 *
 * Pela lição do `gate:canvas`: um portão que nunca falhou e um portão que não
 * sabe falhar escrevem a mesma coisa na consola. A única diferença observável
 * é vê-lo recusar o que devia recusar — e, tão importante, **aceitar o que
 * devia aceitar**.
 *
 * Esta segunda metade não é simetria decorativa. Este portão foi escrito a 28
 * out 2026 e, nas suas primeiras duas versões, acusou o inocente duas vezes:
 *
 *  1. Leu os `create policy` de um ficheiro todos antes dos `drop policy`, e
 *     como as migrações desta base escrevem `drop policy X; create policy X`
 *     para substituir uma política, a substituição aparecia como eliminação.
 *     Acusou oito tabelas de terem RLS sem políticas. As oito tinham.
 *  2. Procurou `security definer` numa janela que ia até à próxima função, e
 *     apanhou as palavras dentro de um comentário em prosa mais abaixo no
 *     ficheiro. Acusou `set_updated_at` e `generate_ticket_ref`, que não são
 *     `definer`.
 *
 * Os dois casos estão em `CASOS_ACEITA` e é isso que impede o regresso. Um
 * portão que acusa o inocente é desligado em duas semanas — e um portão
 * desligado dá verde, que é pior do que não existir.
 *
 *   node scripts/gate/check-rls.test.mjs
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PORTAO = join(dirname(fileURLToPath(import.meta.url)), "check-rls.mjs");

/** Uma migração mínima que o portão considera sã. */
const BASE = {
  "supabase/migrations/20260101000000_base.sql": [
    "create table public.imoveis (",
    "  id uuid primary key default gen_random_uuid(),",
    "  owner_id uuid not null",
    ");",
    "alter table public.imoveis enable row level security;",
    "",
    "create policy imoveis_select on public.imoveis",
    "  for select using (owner_id = auth.uid());",
    "",
    "create or replace function public.is_staff()",
    "returns boolean",
    "language sql",
    "stable",
    "security definer",
    "set search_path = ''",
    "as $$",
    "  select false;",
    "$$;",
  ].join("\n"),
};

function montar(ficheiros) {
  const raiz = mkdtempSync(join(tmpdir(), "upm-rls-"));
  for (const [caminho, conteudo] of Object.entries(ficheiros)) {
    const destino = join(raiz, caminho);
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, conteudo);
  }
  return raiz;
}

function correr(raiz) {
  const r = spawnSync(process.execPath, [PORTAO], {
    env: { ...process.env, UPM_RLS_RAIZ: raiz },
    encoding: "utf8",
  });
  return { codigo: r.status, saida: (r.stdout ?? "") + (r.stderr ?? "") };
}

const CASOS_RECUSA = [
  {
    nome: "tabela em public sem RLS",
    ficheiros: {
      "supabase/migrations/20260102000000_mau.sql": [
        "create table public.leads (id uuid primary key, email text not null);",
      ].join("\n"),
    },
    esperado: /sem RLS/,
  },
  {
    nome: "RLS sem políticas e sem declaração de selagem",
    ficheiros: {
      "supabase/migrations/20260102000000_mau.sql": [
        "create table public.segredos (id uuid primary key);",
        "alter table public.segredos enable row level security;",
      ].join("\n"),
    },
    esperado: /nenhuma política viva/,
  },
  {
    nome: "política com using (true) sem rls-ok",
    ficheiros: {
      "supabase/migrations/20260102000000_mau.sql": [
        "create table public.tudo (id uuid primary key);",
        "alter table public.tudo enable row level security;",
        "create policy tudo_select on public.tudo for select using (true);",
      ].join("\n"),
    },
    esperado: /using \(true\)/,
  },
  {
    nome: "with check (true) sem rls-ok",
    ficheiros: {
      "supabase/migrations/20260102000000_mau.sql": [
        "create table public.escreve (id uuid primary key);",
        "alter table public.escreve enable row level security;",
        "create policy escreve_ins on public.escreve for insert with check (true);",
      ].join("\n"),
    },
    esperado: /using \(true\)/,
  },
  {
    nome: "security definer sem search_path",
    ficheiros: {
      "supabase/migrations/20260102000000_mau.sql": [
        "create or replace function public.eleva()",
        "returns boolean",
        "language sql",
        "security definer",
        "as $$ select true; $$;",
      ].join("\n"),
    },
    esperado: /sem `search_path`/,
  },
  {
    nome: "execute dinâmico com concatenação",
    ficheiros: {
      "supabase/migrations/20260102000000_mau.sql": [
        "create or replace function public.conta(p_tabela text)",
        "returns bigint",
        "language plpgsql",
        "security definer",
        "set search_path = ''",
        "as $$",
        "declare v bigint;",
        "begin",
        "  execute 'select count(*) from ' || p_tabela into v;",
        "  return v;",
        "end;",
        "$$;",
      ].join("\n"),
    },
    esperado: /concatenação/,
  },
  {
    nome: "grant a anon sobre tabela fora da allowlist",
    ficheiros: {
      "supabase/migrations/20260102000000_mau.sql": [
        "create table public.privado (id uuid primary key);",
        "alter table public.privado enable row level security;",
        "create policy privado_select on public.privado for select using (false);",
        "grant select on public.privado to anon, authenticated;",
      ].join("\n"),
    },
    esperado: /papel `anon`/,
  },
];

/**
 * O que tem de PASSAR. Cada um destes é um falso positivo que já aconteceu ou
 * um padrão legítimo que esta base de dados usa todos os dias.
 */
const CASOS_ACEITA = [
  {
    nome: "controlo: migração sem violações",
    ficheiros: {},
  },
  {
    nome: "REGRESSÃO: drop + create da mesma política, no mesmo ficheiro",
    ficheiros: {
      "supabase/migrations/20260102000000_substitui.sql": [
        "drop policy imoveis_select on public.imoveis;",
        "create policy imoveis_select on public.imoveis",
        "  for select using (owner_id = auth.uid() or public.is_staff());",
      ].join("\n"),
    },
  },
  {
    nome: "REGRESSÃO: função não-definer seguida de comentário a dizer 'security definer'",
    ficheiros: {
      "supabase/migrations/20260102000000_prosa.sql": [
        "create or replace function public.set_updated_at()",
        "returns trigger",
        "language plpgsql",
        "as $$",
        "begin",
        "  new.updated_at = now();",
        "  return new;",
        "end;",
        "$$;",
        "",
        "-- Helpers de papel — 02 §7.1. security definer para poderem ler",
        "-- profiles dentro das próprias policies sem recursão de RLS.",
      ].join("\n"),
    },
  },
  {
    nome: "using (true) com rls-ok declarado",
    ficheiros: {
      "supabase/migrations/20260102000000_catalogo.sql": [
        "create table public.precos (id uuid primary key, valor numeric not null);",
        "alter table public.precos enable row level security;",
        "-- rls-ok: catálogo de preços, lido pela página pública sem sessão.",
        "create policy precos_select on public.precos for select using (true);",
      ].join("\n"),
    },
  },
  {
    nome: "grant execute em função a anon (porta estreita, não é tabela)",
    ficheiros: {
      "supabase/migrations/20260102000000_funcao.sql": [
        "create or replace function public.confirma(p_token text)",
        "returns boolean",
        "language sql",
        "security definer",
        "set search_path = ''",
        "as $$ select false; $$;",
        "grant execute on function public.confirma(text) to anon, authenticated;",
      ].join("\n"),
    },
  },
  {
    nome: "tabela criada e depois apagada não é cobrada",
    ficheiros: {
      "supabase/migrations/20260102000000_temporaria.sql": [
        "create table public.rascunho (id uuid primary key);",
        "drop table public.rascunho;",
      ].join("\n"),
    },
  },
  {
    nome: "tabela noutro esquema não é nossa (storage.objects)",
    ficheiros: {
      "supabase/migrations/20260102000000_storage.sql": [
        "create policy anexos_leitura on storage.objects",
        "  for select using (bucket_id = 'documents');",
      ].join("\n"),
    },
  },
];

let falhou = false;

for (const caso of CASOS_RECUSA) {
  const raiz = montar({ ...BASE, ...caso.ficheiros });
  const { codigo, saida } = correr(raiz);
  rmSync(raiz, { recursive: true, force: true });

  if (codigo === 1 && caso.esperado.test(saida)) {
    console.log(`✓ recusa: ${caso.nome}`);
    continue;
  }
  falhou = true;
  console.error(`✗ NÃO recusou: ${caso.nome}  (saiu com ${codigo})`);
  console.error(
    saida
      .split("\n")
      .map((l) => "      " + l)
      .join("\n"),
  );
}

for (const caso of CASOS_ACEITA) {
  const raiz = montar({ ...BASE, ...caso.ficheiros });
  const { codigo, saida } = correr(raiz);
  rmSync(raiz, { recursive: true, force: true });

  if (codigo === 0) {
    console.log(`✓ aceita: ${caso.nome}`);
    continue;
  }
  falhou = true;
  console.error(`✗ recusou o que devia aceitar: ${caso.nome}  (saiu com ${codigo})`);
  console.error(
    saida
      .split("\n")
      .map((l) => "      " + l)
      .join("\n"),
  );
}

if (falhou) {
  console.error("\n  O portão da cerca do Postgres não distingue o que devia. Não confie nele.\n");
  process.exit(1);
}
console.log(
  `\n✓ A cerca do Postgres recusa ${CASOS_RECUSA.length} violações e aceita ${CASOS_ACEITA.length} padrões legítimos`,
);
