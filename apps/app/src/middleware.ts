import { NextResponse, type NextRequest } from "next/server";

import { NONCE_HEADER, applySecurityHeaders, generateNonce } from "@upm/config/security";

import { createMiddlewareClient } from "./lib/supabase-middleware";

/**
 * 07 §4.3 — rotas só do proprietário.
 *
 * `/painel` está aqui enquanto só existir o Painel do proprietário (P4-06). O
 * comprador tem o seu próprio Painel em 04 §8.2; quando existir, esta rota
 * deixa de ser owner-only e passa a escolher o painel pelo papel.
 */
const OWNER_ONLY_PREFIXES = ["/painel", "/propriedades", "/leads", "/agenda"];
/** 07 §4.2 — rotas só do comprador (rota renomeada: /pedidos-de-visita → /meus-pedidos). */
const BUYER_ONLY_PREFIXES = ["/guardados", "/meus-pedidos"];

/**
 * Rotas sem sessão (P6-02 · 07 §13.3)
 * =========================================================================
 * A partilha por ligação existe para chegar a quem NÃO tem conta — é o caso
 * que 07 §13.3 descreve ao falar de "ligação anónima" e de guardar o IP em vez
 * do perfil. Mandar essa pessoa para o ecrã de entrar tornava a ligação
 * inútil.
 *
 * O acesso continua fechado do lado do Postgres: `resolve_file_share` valida o
 * token, a expiração, o código e o limite de tentativas de 07 §19.8. Não é o
 * middleware que autoriza nada aqui — é ele que se afasta do caminho.
 */
const PUBLIC_PREFIXES = ["/partilha"];

function webUrl(path: string, request: NextRequest): URL {
  const base = process.env.WEB_URL ?? "http://localhost:4300";
  return new URL(path, base.startsWith("http") ? base : request.nextUrl.origin);
}

function internoUrl(request: NextRequest): URL {
  const base = process.env.INTERNO_URL ?? "http://localhost:4302";
  return new URL("/", base.startsWith("http") ? base : request.nextUrl.origin);
}

export async function middleware(request: NextRequest) {
  const nonce = generateNonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(NONCE_HEADER, nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  if (PUBLIC_PREFIXES.some((prefix) => request.nextUrl.pathname.startsWith(prefix))) {
    applySecurityHeaders(response.headers, nonce);
    return response;
  }

  const supabase = createMiddlewareClient(request, response);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const next = webUrl("/entrar", request);
    next.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(next);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role;

  // Equipa (admin|support) nunca acede aqui (07 §6) — só interno.*.
  if (role === "admin" || role === "support") {
    return NextResponse.redirect(internoUrl(request));
  }

  const { pathname } = request.nextUrl;
  const isOwnerOnly = OWNER_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isBuyerOnly = BUYER_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if ((isOwnerOnly && role !== "owner") || (isBuyerOnly && role !== "buyer")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  applySecurityHeaders(response.headers, nonce);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|%5F%5Ftempo).*)"],
};
