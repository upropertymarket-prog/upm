import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

type Cookie = { name: string; value: string; options?: Record<string, unknown> };

type CookieStore = {
  getAll: () => { name: string; value: string }[];
  set: (name: string, value: string, options?: Record<string, unknown>) => void;
};

/**
 * Cliente Supabase para Server Components e Server Actions.
 * Recebe o cookie store do Next para propagar a sessão (02 §3.3).
 *
 * `AUTH_COOKIE_DOMAIN` partilha o cookie de sessão entre `www`, `app.*` e
 * `interno.*` em produção (ver nota em `client.ts`). Sem valor em dev.
 */
export function createClient(cookies: CookieStore) {
  const domain = process.env.AUTH_COOKIE_DOMAIN;
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookies.getAll(),
        setAll: (toSet: Cookie[]) => {
          for (const { name, value, options } of toSet) {
            cookies.set(name, value, options);
          }
        },
      },
      ...(domain ? { cookieOptions: { domain } } : {}),
    },
  );
}

export type ServiceClient = SupabaseClient<Database>;

/**
 * Cliente com `service_role`, para o que nenhuma sessão de utilizador pode
 * escrever: webhooks, jobs, e as funções `security definer` que só o servidor
 * chama (ex. `mark_step_up` de P8-07).
 *
 * Não passa por RLS — por isso só existe em contextos de servidor e nunca se
 * importa a partir de um ficheiro que o cliente possa carregar. Atira quando
 * falta a chave, em vez de devolver um cliente anónimo que falharia mais à
 * frente com uma mensagem que não explica nada (Fase 7, Adenda 2).
 */
export function createServiceClient(): ServiceClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
