import { createServerClient } from "@supabase/ssr";

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
