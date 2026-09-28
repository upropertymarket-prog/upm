import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./database.types";

/**
 * Cliente Supabase para o browser. Usa sempre a anon key: toda a leitura
 * sensível passa por RLS (02 §3.3). A `service_role` nunca chega ao cliente.
 *
 * `/entrar`, `/criar-conta` e `/recuperar-palavra-passe` vivem em `www` (03
 * §1.1), mas a sessão é consumida em `app.*`/`interno.*` — em produção isto
 * exige o cookie de sessão partilhado entre subdomínios via
 * `AUTH_COOKIE_DOMAIN` (ex. `.upropertymarket.pt`). Em dev local (tudo em
 * `localhost`, só portas diferentes) o cookie já é partilhado sem isto — o
 * `Domain` de um cookie não distingue porta.
 */
export function createClient() {
  const domain = process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN;
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    domain ? { cookieOptions: { domain } } : undefined,
  );
}
