/**
 * Teste negativo do portão da fronteira do servidor.
 *
 * Pela lição do `gate:canvas`, e com a mesma estrutura do
 * `check-rls.test.mjs`: metade dos casos tem de ser recusada, metade tem de
 * ser aceite. A segunda metade é a que impede que o portão seja desligado —
 * um portão que recusa `console.error` ou que acusa um ficheiro de teste de
 * usar `service_role` é um portão que alguém comenta no CI numa sexta-feira.
 *
 *   node scripts/gate/check-server-boundary.test.mjs
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PORTAO = join(dirname(fileURLToPath(import.meta.url)), "check-server-boundary.mjs");

/**
 * O repositório mínimo são. `packages/db/src/server.ts` está na allowlist do
 * portão, por isso serve de prova de que a allowlist é lida.
 */
const BASE = {
  "packages/db/src/server.ts": [
    "export function createServiceClient() {",
    "  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;",
    "  if (!key) throw new Error('falta a chave');",
    "  return key;",
    "}",
  ].join("\n"),
  "apps/web/src/lib/ok.ts": "export const soma = (a: number, b: number) => a + b;",
};

function montar(ficheiros) {
  const raiz = mkdtempSync(join(tmpdir(), "upm-fronteira-"));
  for (const [caminho, conteudo] of Object.entries(ficheiros)) {
    const destino = join(raiz, caminho);
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, conteudo);
  }
  return raiz;
}

function correr(raiz) {
  const r = spawnSync(process.execPath, [PORTAO], {
    env: { ...process.env, UPM_FRONTEIRA_RAIZ: raiz },
    encoding: "utf8",
  });
  return { codigo: r.status, saida: (r.stdout ?? "") + (r.stderr ?? "") };
}

const CASOS_RECUSA = [
  {
    nome: "service_role num ficheiro novo",
    ficheiros: {
      "apps/app/src/app/actions/novo.ts": [
        '"use server";',
        'import { createServiceClient } from "@upm/db/server";',
        "export async function apagar(id: string) {",
        "  const db = createServiceClient();",
        '  await db.from("imoveis").delete().eq("id", id);',
        "}",
      ].join("\n"),
    },
    esperado: /fora da allowlist/,
  },
  {
    nome: "a chave lida direto do ambiente num ficheiro novo",
    ficheiros: {
      "apps/app/src/lib/atalho.ts": [
        "export const chave = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';",
      ].join("\n"),
    },
    esperado: /fora da allowlist/,
  },
  {
    nome: "console.log em código de app",
    ficheiros: {
      "apps/web/src/app/mau.ts": [
        "export function registar(lead: { email: string }) {",
        "  console.log(lead);",
        "}",
      ].join("\n"),
    },
    esperado: /console\.log/,
  },
  {
    nome: "dangerouslySetInnerHTML sem html-ok",
    ficheiros: {
      "packages/ui/src/mau.tsx": [
        "export const Corpo = ({ html }: { html: string }) => (",
        "  <div dangerouslySetInnerHTML={{ __html: html }} />",
        ");",
      ].join("\n"),
    },
    esperado: /sem origem declarada/,
  },
];

const CASOS_ACEITA = [
  { nome: "controlo: repositório são", ficheiros: {} },
  {
    nome: "service_role num ficheiro de teste não conta",
    ficheiros: {
      "packages/db/src/novo-rls.test.ts": [
        'import { createServiceClient } from "./server";',
        "test('rls', async () => { createServiceClient(); });",
      ].join("\n"),
    },
  },
  {
    nome: "console.error passa (é o caminho certo)",
    ficheiros: {
      "apps/web/src/app/bom.ts": [
        "export function falhou(razao: string) {",
        '  console.error(`[web] falhou: ${razao}`);',
        "}",
      ].join("\n"),
    },
  },
  {
    nome: "REGRESSÃO: console.log dentro de um comentário não conta",
    ficheiros: {
      "apps/web/src/app/prosa.ts": [
        "// Não use console.log(objeto) aqui: leva dados pessoais para o Sentry.",
        "export const x = 1;",
      ].join("\n"),
    },
  },
  {
    nome: "dangerouslySetInnerHTML com html-ok declarado",
    ficheiros: {
      "packages/ui/src/bom.tsx": [
        "export const Corpo = ({ html }: { html: string }) => (",
        "  // html-ok: sanitizado na escrita por `signatures.ts`.",
        "  <div dangerouslySetInnerHTML={{ __html: html }} />",
        ");",
      ].join("\n"),
    },
  },
  {
    nome: "código compilado em dist/ não é varrido",
    ficheiros: {
      "apps/mail-worker/dist/index.js": [
        "const k = process.env.SUPABASE_SERVICE_ROLE_KEY;",
        "console.log(k);",
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
  console.error("\n  O portão da fronteira do servidor não distingue o que devia. Não confie nele.\n");
  process.exit(1);
}
console.log(
  `\n✓ A fronteira do servidor recusa ${CASOS_RECUSA.length} violações e aceita ${CASOS_ACEITA.length} padrões legítimos`,
);
