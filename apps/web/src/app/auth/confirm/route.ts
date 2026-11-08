import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@upm/db/server";

import { caminhoSeguro } from "@/lib/caminho-seguro";

/**
 * Troca o `code` PKCE do link de e-mail (confirmação de registo ou
 * recuperação de palavra-passe) por uma sessão. Padrão oficial do
 * `@supabase/ssr` para Next.js App Router.
 *
 * O template do e-mail de confirmação do projeto de staging tem de apontar
 * para aqui (`{{ .SiteURL }}/auth/confirm?...`) — configuração manual na
 * Supabase Studio, não algo que a migração consiga automatizar (dívida
 * registada no relatório da fase).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = caminhoSeguro(searchParams.get("next"));

  if (code) {
    const supabase = createClient(await cookies());
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/entrar?erro=link_invalido`);
}
