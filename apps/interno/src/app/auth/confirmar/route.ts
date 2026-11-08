import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@upm/db/server";

/**
 * O link de recuperação da equipa (8 nov 2026, `lib/staff-access.ts`)
 * =========================================================================
 * Troca o `token_hash` do e-mail por uma sessão e leva a definir a palavra-
 * passe nova. É o padrão do `@supabase/ssr` para links gerados no servidor
 * (`verifyOtp` com `token_hash`), e não o de código PKCE: o link não nasceu
 * num browser, nasceu no `generateLink` da API de administração.
 *
 * A sessão que daqui sai é de nível `aal1` (só palavra-passe). O middleware
 * só a deixa chegar a `/nova-palavra-passe`; tudo o resto continua a pedir o
 * código da app.
 *
 * Só `type=recovery`: este caminho não confirma registos nem convites — o
 * interno não tem nenhum dos dois.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (tokenHash && type === "recovery") {
    const supabase = createClient(await cookies());
    const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}/nova-palavra-passe`);
  }

  return NextResponse.redirect(`${origin}/entrar?erro=link_invalido`);
}
