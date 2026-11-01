import { NextResponse, type NextRequest } from "next/server";

import {
  NONCE_HEADER,
  applySecurityHeaders,
  clientIpFrom,
  generateNonce,
  invalidCidrsIn,
  isIpAllowed,
} from "@upm/config/security";

import { createMiddlewareClient } from "./lib/supabase-middleware";
import {
  LAST_ACTIVITY_COOKIE,
  RECOVERY_VERIFIED_COOKIE,
  SESSION_COOKIES,
  SESSION_STARTED_COOKIE,
} from "./lib/session";

/**
 * As três áreas internas, e cada uma só para o seu papel (07 §24.6).
 *
 * `/marketing` entrou a 14 out 2026 com P10-07, a tarefa que faz a área
 * nascer. O guarda é por prefixo e não por `is_staff()` de propósito: o
 * marketing **não** é staff (ver `is_marketing()` em `20261014120100`), e um
 * guarda que lesse "é da equipa?" dava-lhe a moderação de imóveis e o
 * diretório de utilizadores de uma vez.
 */
const AREA_PREFIX = {
  "/admin": "admin",
  "/suporte": "support",
  "/marketing": "marketing",
} as const;

const SESSION_MAX_MS = 8 * 60 * 60 * 1000;
const INACTIVITY_MAX_MS = 30 * 60 * 1000;

function appUrl(request: NextRequest): URL {
  const base = process.env.APP_URL ?? "http://localhost:4301";
  return new URL("/", base.startsWith("http") ? base : request.nextUrl.origin);
}

async function signOutAndRedirectToLogin(request: NextRequest, suspended = false) {
  const loginUrl = new URL("/entrar", request.url);
  if (suspended) loginUrl.searchParams.set("suspended", "1");
  const redirectResponse = NextResponse.redirect(loginUrl);
  const supabase = createMiddlewareClient(request, redirectResponse);
  await supabase.auth.signOut();
  for (const name of SESSION_COOKIES) redirectResponse.cookies.delete(name);
  return redirectResponse;
}

export async function middleware(request: NextRequest) {
  const nonce = generateNonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(NONCE_HEADER, nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  const supabase = createMiddlewareClient(request, response);
  const { pathname } = request.nextUrl;

  // Allowlist de IP/VPN (07 §6) — antes de tudo, mesmo do login.
  const { data: allowlistFlag } = await supabase
    .from("feature_flags")
    .select("value")
    .eq("key", "interno_ip_allowlist")
    .maybeSingle();
  const allowlist = Array.isArray(allowlistFlag?.value) ? (allowlistFlag.value as string[]) : [];

  // Uma entrada que a allowlist não entende é descartada — e é preciso que se
  // ouça. Caso contrário quem a escreveu fica a contar com uma proteção que
  // tem menos redes do que ele pensa, que foi exatamente o que aconteceu
  // enquanto os CIDRs IPv6 eram ignorados em silêncio (12 §2.3).
  if (allowlist.length > 0) {
    const invalidos = invalidCidrsIn(allowlist);
    if (invalidos.length > 0) {
      // A lista vai como argumento à parte e não interpolada: o `gate:i18n`
      // varre o texto dentro de template literals, e um fragmento em português
      // ali é indistinguível de uma frase de ecrã. Os outros logs desta base
      // escrevem-se da mesma forma.
      console.error("[interno] interno_ip_allowlist: entradas inválidas ignoradas", invalidos);
    }
  }

  const clientIp = clientIpFrom(request.headers);
  if (allowlist.length > 0 && (!clientIp || !isIpAllowed(clientIp, allowlist))) {
    return new NextResponse("Acesso não permitido a partir desta rede.", { status: 403 });
  }

  const publicPaths = ["/entrar", "/verificar-2fa"];
  if (publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    applySecurityHeaders(response.headers, nonce);
    return response;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/entrar", request.url));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .single();
  const role = profile?.role ?? null;
  if (profile?.status === "suspended") {
    return signOutAndRedirectToLogin(request, true);
  }
  if (role !== "admin" && role !== "support" && role !== "marketing") {
    // Sessão de comprador/proprietário chegou aqui via cookie partilhado — não pertence.
    return NextResponse.redirect(appUrl(request));
  }

  // 2FA TOTP obrigatório (07 §6) — usa o MFA nativo do Supabase Auth (AAL2).
  // Um código de recuperação (verificar-2fa/actions.ts) não eleva o AAL do
  // Supabase — aceita-se em alternativa o cookie que essa via assina.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const recoveryVerified = request.cookies.get(RECOVERY_VERIFIED_COOKIE)?.value === "1";
  const onEnrollPage = pathname === "/configurar-2fa" || pathname.startsWith("/configurar-2fa/");
  if (aal?.nextLevel === "aal1" && !onEnrollPage) {
    return NextResponse.redirect(new URL("/configurar-2fa", request.url));
  }
  if (aal && aal.currentLevel !== aal.nextLevel && !recoveryVerified && !onEnrollPage) {
    return NextResponse.redirect(new URL("/verificar-2fa", request.url));
  }

  // Sessão absoluta 8h + inatividade 30 min (07 §6).
  const now = Date.now();
  const startedAt = Number(request.cookies.get(SESSION_STARTED_COOKIE)?.value ?? now);
  const lastActivityAt = Number(request.cookies.get(LAST_ACTIVITY_COOKIE)?.value ?? now);

  if (now - startedAt > SESSION_MAX_MS || now - lastActivityAt > INACTIVITY_MAX_MS) {
    return signOutAndRedirectToLogin(request);
  }

  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
  response.cookies.set(SESSION_STARTED_COOKIE, String(startedAt), cookieOptions);
  response.cookies.set(LAST_ACTIVITY_COOKIE, String(now), cookieOptions);

  // Cada área só para o seu papel. O destino é a raiz, que encaminha cada um
  // para a sua — e não um 403: quem se perde num link antigo quer chegar ao
  // trabalho dele, não a uma parede.
  for (const [prefix, allowed] of Object.entries(AREA_PREFIX)) {
    if (pathname.startsWith(prefix) && role !== allowed) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  applySecurityHeaders(response.headers, nonce);
  return response;
}

/**
 * `api/health` fica **fora** do matcher (12 §9.1).
 *
 * Não é só o guard de sessão: é a allowlist de IP, que corre antes do próprio
 * login. Com ela ativa, um monitor externo — que por definição não está na
 * rede da equipa — receberia 403 de minuto a minuto e reportaria o `interno`
 * em baixo para sempre.
 *
 * Deixá-la de fora não abre nada: a resposta é `{ ok }` e um código de estado,
 * sem dizer o que falhou.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|%5F%5Ftempo|api/health).*)"],
};
