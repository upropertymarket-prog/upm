import "server-only";
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

/** O que as páginas usam do utilizador: o mesmo que o `getUser()` devolvia, só isto. */
export type SessionUser = {
  id: string;
  email?: string;
  user_metadata: Record<string, unknown>;
  app_metadata: Record<string, unknown>;
};

/**
 * O utilizador da sessão, validado sem ir à rede (3 nov 2026)
 * =========================================================================
 * `auth.getUser()` pergunta ao servidor de Auth em cada chamada: ~100 ms a
 * partir daqui, e as páginas da `app` faziam-no **depois** de o middleware já
 * o ter feito. Medido: até uma página simples custava o dobro das do site.
 *
 * `auth.getClaims()` valida a assinatura do token localmente, com a chave
 * pública do projeto (ES256, guardada em cache), e só vai à rede quando o
 * token tem de ser renovado. A troca, dita: uma sessão terminada noutro sítio
 * continua válida até o token expirar (≤ 1 h). Contas suspensas e eliminadas
 * continuam barradas de imediato — o middleware lê `profiles.status` na base
 * em cada pedido. É o que o Supabase recomenda para o servidor.
 *
 * Devolve a mesma forma de `getUser()` (`{ data: { user } }`), para a troca
 * ser direta. As Server Actions, que escrevem, continuam no `getUser()`.
 */
export async function obterUtilizador(
  supabase: SupabaseClient<Database>,
): Promise<{ data: { user: SessionUser | null } }> {
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return { data: { user: null } };
  return {
    data: {
      user: {
        id: claims.sub,
        email: typeof claims.email === "string" ? claims.email : undefined,
        user_metadata: (claims.user_metadata as Record<string, unknown>) ?? {},
        app_metadata: (claims.app_metadata as Record<string, unknown>) ?? {},
      },
    },
  };
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

/**
 * Cliente **anónimo e sem sessão**, para leituras públicas que ficam em cache.
 *
 * Existe por causa do Site público (P2-01): o `launch_mode`, o catálogo de
 * planos e os imóveis recentes são iguais para toda a gente, e ler com
 * `createClient(cookies)` tornava a resposta impossível de partilhar em cache
 * — um `cookies()` num Server Component marca a rota como dinâmica, e a home
 * passaria a ser renderizada por pedido.
 *
 * Não é um atalho à RLS, é o contrário: passa por ela com o papel `anon`, que
 * é exactamente o que um visitante tem. O que este cliente não vê, o visitante
 * também não devia ver.
 */
export function createAnonClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
