/**
 * Portão §6.1 — nenhuma variável sensível com prefixo NEXT_PUBLIC_.
 *
 * Tudo o que tem esse prefixo é inlined no bundle do browser em texto claro e
 * fica lá para sempre. Só as variáveis desta lista branca são aceites; qualquer
 * outra falha o portão e tem de passar a variável de servidor.
 *
 * Doc 08 §6.1.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ALLOWLIST = new Set([
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SENTRY_DSN",
  "NEXT_PUBLIC_LAUNCH_MODE",
  // Fase 3 — cookie de sessão partilhado entre subdomínios (07 §9.1-adjacent,
  // ver packages/db/src/client.ts). Não é segredo, só um domínio de cookie.
  "NEXT_PUBLIC_AUTH_COOKIE_DOMAIN",
]);

const PUBLIC_VAR = /\bNEXT_PUBLIC_[A-Z0-9_]+/g;

/** Ficheiros onde faz sentido procurar: código-fonte e ficheiros de ambiente. */
function collect(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      collect(full, out);
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name) || entry.name.startsWith(".env")) {
      out.push(full);
    }
  }
  return out;
}

const offenders = new Map();

for (const file of [...collect("apps"), ...collect("packages"), ...collect("scripts")]) {
  const text = readFileSync(file, "utf8");
  for (const match of text.match(PUBLIC_VAR) ?? []) {
    if (ALLOWLIST.has(match)) continue;
    if (!offenders.has(match)) offenders.set(match, new Set());
    offenders.get(match).add(file);
  }
}

if (offenders.size === 0) {
  console.log(`✓ NEXT_PUBLIC_: só as ${ALLOWLIST.size} variáveis da lista branca`);
  process.exit(0);
}

console.error("✗ Variáveis NEXT_PUBLIC_ fora da lista branca (doc 08 §6.1):\n");
for (const [name, files] of offenders) {
  console.error(`  ${name}`);
  for (const f of files) console.error(`      ${f}`);
}
console.error(
  "\nUma variável NEXT_PUBLIC_ vai em texto claro para o browser.",
  "\nSe é sensível, tira o prefixo e usa-a só no servidor.",
  "\nSe é mesmo pública, acrescenta-a à ALLOWLIST deste script e ao doc 08 §6.1.",
);
process.exit(1);
