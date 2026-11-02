/**
 * O ambiente dos E2E — lido dos `.env.local` das apps, sem cópias
 * =========================================================================
 * Os segredos já vivem em `apps/*\/.env.local` (fora do git). Copiá-los para
 * um terceiro sítio era criar o terceiro sítio onde se esquecem de mudar.
 * Lê-se o do `app`, que tem tudo o que os testes precisam: Supabase (anon e
 * serviço) e o Stripe de teste.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ENV_APP = fileURLToPath(new URL("../../../apps/app/.env.local", import.meta.url));

function lerEnv(caminho: string): Record<string, string> {
  if (!existsSync(caminho)) return {};
  const out: Record<string, string> = {};
  for (const linha of readFileSync(caminho, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(linha.trim());
    if (m) out[m[1]!] = m[2]!.replace(/^"(.*)"$/, "$1");
  }
  return out;
}

const env = { ...lerEnv(ENV_APP), ...process.env } as Record<string, string | undefined>;

export const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
export const STRIPE_SECRET = env.STRIPE_SECRET_KEY ?? "";
export const STRIPE_WEBHOOK_SECRET = env.STRIPE_WEBHOOK_SECRET ?? "";

// Portas próprias dos E2E — ver `playwright.config.ts`. Não se lêem do
// `.env.local`, que aponta para os dev servers de trabalho (4300–4302).
export const WEB = process.env.E2E_WEB_URL ?? "http://localhost:4400";
export const APP = process.env.E2E_APP_URL ?? "http://localhost:4401";
export const INTERNO = process.env.E2E_INTERNO_URL ?? "http://localhost:4402";

/** Sem base não há E2E — saltam, como os `*-rls.test.ts`. */
export const temBase = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY);

/** O Stripe tem de ser de teste. Uma chave `sk_live_` aqui seria um desastre. */
export const temStripeDeTeste =
  STRIPE_SECRET.startsWith("sk_test_") && Boolean(STRIPE_WEBHOOK_SECRET);
