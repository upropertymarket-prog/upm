import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./database.types";

/**
 * Cliente Supabase para o browser. Usa sempre a anon key: toda a leitura
 * sensível passa por RLS (02 §3.3). A `service_role` nunca chega ao cliente.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
