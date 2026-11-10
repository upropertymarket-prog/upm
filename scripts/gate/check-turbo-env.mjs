/**
 * Portão — cada variável de ambiente que o código lê está no `turbo.json`.
 *
 * Na Vercel o build corre por `turbo run build`, e o Turborepo (modo estrito)
 * **esconde do build** toda a variável que não esteja declarada em
 * `globalEnv`. No runtime a variável existe; no build não. O efeito é
 * silencioso: o que se gera no build (o sitemap, o `NEXT_PUBLIC_*` que vai no
 * bundle) sai com o valor de recurso.
 *
 * Visto no primeiro deploy (10 nov 2026): o `sitemap.xml` de produção
 * anunciava `http://localhost:4300`, e a `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`
 * não chegava ao build — o Next gerava uma chave nova a cada deploy, que é
 * exatamente o que essa variável existe para impedir.
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

/** Postas pelo ambiente ou pelo próprio Node/Next — não se declaram. */
const DO_AMBIENTE = new Set(["CI", "NODE_ENV", "NEXT_RUNTIME"]);
/** Lidas pelo próprio Next, sem aparecerem no nosso código. */
const DO_NEXT = ["NEXT_SERVER_ACTIONS_ENCRYPTION_KEY"];

const IGNORAR = new Set([
  "node_modules",
  ".next",
  ".next-e2e",
  ".next-e2e-pre",
  "dist",
  "coverage",
]);
const EXT = /\.(ts|tsx|mjs|js)$/;
const TESTE = /\.(test|spec)\.(ts|tsx|mjs|js)$/;

function ficheiros(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const nome of readdirSync(dir)) {
    if (IGNORAR.has(nome)) continue;
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) ficheiros(caminho, out);
    else if (EXT.test(nome) && !TESTE.test(nome)) out.push(caminho);
  }
  return out;
}

const pastas = [];
for (const grupo of ["apps", "packages"]) {
  for (const nome of readdirSync(join(RAIZ, grupo))) {
    const base = join(RAIZ, grupo, nome);
    pastas.push(join(base, "src"));
    for (const f of readdirSync(base)) {
      if (/^(next|sentry)\..*config|^instrumentation/.test(f) && EXT.test(f))
        pastas.push(join(base, f));
    }
  }
}

const lidas = new Map();
for (const alvo of pastas) {
  const lista = existsSync(alvo) && statSync(alvo).isFile() ? [alvo] : ficheiros(alvo);
  for (const f of lista) {
    for (const m of readFileSync(f, "utf8").matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) {
      if (!lidas.has(m[1])) lidas.set(m[1], relative(RAIZ, f));
    }
  }
}
for (const v of DO_NEXT) lidas.set(v, "(lida pelo Next)");

const turbo = JSON.parse(readFileSync(join(RAIZ, "turbo.json"), "utf8"));
const declaradas = new Set(turbo.globalEnv ?? []);

const faltam = [...lidas].filter(([v]) => !DO_AMBIENTE.has(v) && !declaradas.has(v));
if (faltam.length) {
  console.error(
    `✗ Variáveis lidas pelo código e ausentes de turbo.json › globalEnv: ${faltam.length}`,
  );
  for (const [v, onde] of faltam) console.error(`    ${v}  (${onde})`);
  console.error(
    "\nNa Vercel o build corre por `turbo run build`, que esconde do build o que não\n" +
      "estiver declarado. Acrescente-as a `globalEnv`.",
  );
  process.exit(1);
}
console.log(`✓ turbo.json declara as ${lidas.size} variáveis que o código lê`);
