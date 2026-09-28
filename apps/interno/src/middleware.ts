import { NextResponse, type NextRequest } from "next/server";

import {
  NONCE_HEADER,
  applySecurityHeaders,
  clientIpFrom,
  generateNonce,
  isIpAllowed,
} from "@upm/config/security";

import { createMiddlewareClient } from "./lib/supabase-middleware";

const ADMIN_ONLY_PREFIX = "/admin";
const SUPPORT_ONLY_PREFIX = "/suporte";

const SESSION_STARTED_COOKIE = "interno_session_started_at";
const LAST_ACTIVITY_COOKIE = "interno_last_activity_at";
const SESSION_MAX_MS = 8 * 60 * 60 * 1000;
const INACTIVITY_MAX_MS = 30 * 60 * 1000;

function appUrl(request: NextRequest): URL {
  const base = process.env.APP_URL ?? "http://localhost:4301";
  return new URL("/", base.startsWith("http") ? base : request.nextUrl.origin);
}

async function signOutAndRedirectToLogin(request: NextRequest) {
  const redirectResponse = NextResponse.redirect(new URL("/entrar", request.url));
  const supabase = createMiddlewareClient(request, redirectResponse);
  await supabase.auth.signOut();
  redirectResponse.cookies.delete(SESSION_STARTED_COOKIE);
  redirectResponse.cookies.delete(LAST_ACTIVITY_COOKIE);
  redirectResponse.cookies.delete("interno_recovery_verified");
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
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role;
  if (role !== "admin" && role !== "support") {
    // Sessão de comprador/proprietário chegou aqui via cookie partilhado — não pertence.
    return NextResponse.redirect(appUrl(request));
  }

  // 2FA TOTP obrigatório (07 §6) — usa o MFA nativo do Supabase Auth (AAL2).
  // Um código de recuperação (verificar-2fa/actions.ts) não eleva o AAL do
  // Supabase — aceita-se em alternativa o cookie que essa via assina.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const recoveryVerified = request.cookies.get("interno_recovery_verified")?.value === "1";
  if (aal?.nextLevel === "aal1") {
    return NextResponse.redirect(new URL("/configurar-2fa", request.url));
  }
  if (aal && aal.currentLevel !== aal.nextLevel && !recoveryVerified) {
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

  if (pathname.startsWith(ADMIN_ONLY_PREFIX) && role !== "admin") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (pathname.startsWith(SUPPORT_ONLY_PREFIX) && role !== "support") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  applySecurityHeaders(response.headers, nonce);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|%5F%5Ftempo).*)"],
};
