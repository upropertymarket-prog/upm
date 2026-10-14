/**
 * Portão §6.2 — nenhum segredo no bundle servido ao browser.
 *
 * Corre depois do build e varre `apps/*​/.next/static` à procura de padrões de
 * credencial. A anon key do Supabase é legítima e está excluída: é desenhada
 * para ser pública e é protegida por RLS.
 *
 * Doc 08 §6.2.
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const PATTERNS = [
  { name: "token de acesso Supabase", re: /\bsbp_[a-f0-9]{40}\b/ },
  { name: "chave secreta Supabase", re: /\bsb_secret_[A-Za-z0-9_-]{20,}/ },
  { name: "service_role (JWT)", re: /"role"\s*:\s*"service_role"/ },
  { name: "service_role (literal)", re: /\bSUPABASE_SERVICE_ROLE_KEY\b\s*[:=]\s*["'][^"']+["']/ },
  { name: "chave secreta Stripe", re: /\bsk_(live|test)_[A-Za-z0-9]{20,}/ },
  { name: "segredo de webhook Stripe", re: /\bwhsec_[A-Za-z0-9]{20,}/ },
  { name: "chave privada PEM", re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "token GitHub", re: /\bgh[pousr]_[A-Za-z0-9]{36,}/ },
  { name: "chave de API Resend", re: /\bre_[A-Za-z0-9]{20,}/ },
];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (statSync(full).size < 20_000_000) out.push(full);
  }
  return out;
}

/**
 * Só as apps **Next**, e é por isso que o teste é a existência de um
 * `next.config`.
 *
 * O portão varria `apps/*` e exigia `.next/static` a todas. Funcionou até
 * `apps/mail-worker` nascer, em P10-03: um processo Node que compila com `tsc`
 * e nunca terá `.next`. A partir daí **este portão falhava sempre** — e é o
 * portão que verifica que nenhum segredo vai no bundle servido ao browser
 * (08 §6.2). Um portão que falha sempre é um portão que se aprende a ignorar,
 * que é pior do que não o ter.
 *
 * O teste fica pelo `next.config` e não por uma lista de nomes: uma app nova
 * entra sozinha, e é essa a razão de não ser uma allowlist.
 */
const NEXT_CONFIGS = ["next.config.ts", "next.config.js", "next.config.mjs"];

const apps = existsSync("apps")
  ? readdirSync("apps", { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter((name) => NEXT_CONFIGS.some((file) => existsSync(join("apps", name, file))))
  : [];

let scanned = 0;
const findings = [];

for (const app of apps) {
  const staticDir = join("apps", app, ".next", "static");
  if (!existsSync(staticDir)) {
    console.error(`✗ ${app}: falta .next/static — corre 'pnpm build' antes do portão`);
    process.exit(1);
  }
  for (const file of walk(staticDir)) {
    scanned++;
    const text = readFileSync(file, "latin1");
    for (const { name, re } of PATTERNS) {
      if (re.test(text)) findings.push({ app, file, name });
    }
  }
}

if (findings.length === 0) {
  console.log(`✓ Bundle do cliente limpo: ${scanned} ficheiros varridos em ${apps.length} apps`);
  process.exit(0);
}

console.error("✗ SEGREDOS NO BUNDLE DO CLIENTE (doc 08 §6.2):\n");
for (const f of findings) console.error(`  [${f.app}] ${f.name}\n      ${f.file}`);
console.error("\nUm segredo que chegou ao browser está comprometido. Roda a credencial.");
process.exit(1);
