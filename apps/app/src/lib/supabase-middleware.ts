import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

import type { Database } from "@upm/db";

/**
 * Cliente Supabase para `middleware.ts` — só aqui, porque o `NextRequest`/
 * `NextResponse` do Edge não são o `cookies()` do Server Components que
 * `@upm/db/server` espera (02 §3.3).
 */
export function createMiddlewareClient(request: NextRequest, response: NextResponse) {
  const domain = process.env.AUTH_COOKIE_DOMAIN;
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
      ...(domain ? { cookieOptions: { domain } } : {}),
    },
  );
}
