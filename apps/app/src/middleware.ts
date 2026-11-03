import { NextResponse, type NextRequest } from "next/server";

import { NONCE_HEADER, applySecurityHeaders, generateNonce } from "@upm/config/security";

import { obterUtilizador } from "@upm/db/server";

import { createMiddlewareClient } from "./lib/supabase-middleware";

/**
 * 07 §4.3 — rotas só do proprietário.
 *
 * `/painel` saiu desta lista quando o Painel do comprador passou a existir
 * (04 §2.4 · D33): a rota escolhe o painel pelo papel, lido do servidor em
 * `painel/page.tsx`, e cada papel só vê o seu.
 */
const OWNER_ONLY_PREFIXES = ["/propriedades", "/leads", "/agenda"];
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
const PUBLIC_PREFIXES = ["/partilha", "/conta-suspensa"];

/**
 * Rotas alcançáveis SEM subscrição ativa (Fase 9 — P9-05)
 * =========================================================================
 * **Decisão do cliente, 7 out 2026:** não há plano gratuito nem trial, e uma
 * conta sem subscrição ativa só chega à contratação e às definições.
 *
 * Porque é que `/definicoes` está aqui: é onde vive a Zona de perigo — exportar
 * os dados e eliminar a conta (P9-06). Fechá-la deixava quem desistiu sem
 * caminho para sair, o que seria um problema de RGPD a troco de nada.
 *
 * Isto é o guard de navegação, não a autorização. Quem a aplica é o Postgres:
 * sem subscrição, `effective_limits()` devolve zero em todas as chaves e os
 * gatilhos de 07 §20.5 recusam publicar, guardar, criar alertas e abrir
 * conversas. Se este ficheiro desaparecesse, nada ficava escrito.
 */
const NO_SUBSCRIPTION_PREFIXES = ["/plano", "/definicoes", "/api"];

function webUrl(path: string, request: NextRequest): URL {
  const base = process.env.WEB_URL ?? "http://localhost:4300";
  return new URL(path, base.startsWith("http") ? base : request.nextUrl.origin);
}

function internoUrl(request: NextRequest): URL {
  const base = process.env.INTERNO_URL ?? "http://localhost:4302";
  return new URL("/", base.startsWith("http") ? base : request.nextUrl.origin);
}

async function signOutToSuspendedPage(request: NextRequest) {
  const redirectResponse = NextResponse.redirect(webUrl("/conta-suspensa", request));
  const supabase = createMiddlewareClient(request, redirectResponse);
  await supabase.auth.signOut();
  return redirectResponse;
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

  // A sessão valida-se localmente (`obterUtilizador` → `getClaims`, chave
  // ES256 em cache) e o perfil e a subscrição pedem-se ao mesmo tempo. Eram
  // três idas ao Supabase em série — `getUser`, perfil, `subscription_entitled`
  // —, ~300 ms antes de qualquer página começar (medido a 3 nov). Agora é uma.
  const {
    data: { user },
  } = await obterUtilizador(supabase);

  if (!user) {
    const next = webUrl("/entrar", request);
    next.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(next);
  }

  const { pathname } = request.nextUrl;
  const precisaDePlano = !NO_SUBSCRIPTION_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const [{ data: profile }, { data: entitled }] = await Promise.all([
    supabase.from("profiles").select("role, status").eq("id", user.id).single(),
    precisaDePlano
      ? supabase.rpc("subscription_entitled")
      : Promise.resolve({ data: true as boolean | null }),
  ]);

  const role = profile?.role;

  // Uma conta eliminada (P9-06) não tem sessão, pela mesma porta das suspensas:
  // o perfil ficou anonimizado e deixar entrar era tornar a eliminação
  // cosmética.
  // `as string`: `deleted` entra nos tipos com `pnpm db:types` (P9-06).
  const status = profile?.status as string | undefined;
  if (status === "suspended" || status === "deleted") {
    return signOutToSuspendedPage(request);
  }

  // Equipa (admin|support) nunca acede aqui (07 §6) — só interno.*.
  if (role === "admin" || role === "support") {
    return NextResponse.redirect(internoUrl(request));
  }

  const isOwnerOnly = OWNER_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isBuyerOnly = BUYER_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if ((isOwnerOnly && role !== "owner") || (isBuyerOnly && role !== "buyer")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // P9-05 — sem subscrição ativa, tudo encaminha para a contratação.
  //
  // `subscription_entitled()` é a única resposta a esta pergunta (decidir a
  // partir de `profiles.plan_id` dava duas). Pede-se em paralelo com o
  // perfil, acima: a decisão só se aplica depois de o perfil ter passado.
  if (precisaDePlano && entitled !== true) {
    return NextResponse.redirect(new URL("/plano?subscrever=1", request.url));
  }

  applySecurityHeaders(response.headers, nonce);
  return response;
}

/**
 * O webhook do Stripe fica FORA do middleware (P7-03).
 *
 * Não é um ecrã: é uma máquina a falar com outra, e já se autentica sozinha —
 * pela assinatura `stripe-signature`, verificada antes de o corpo ser lido.
 * Deixá-lo no matcher fazia o guard de sessão redirecionar o POST para
 * `/entrar` com um 307, e o Stripe tentava durante dias sem nunca entregar
 * nada. Foi exatamente o que aconteceu na primeira verificação com o
 * `stripe listen`.
 *
 * Também evita correr uma chamada de autenticação ao Supabase por cada evento
 * recebido, que não serviria para nada — o webhook escreve com `service_role`.
 *
 * **`api/health` sai pela mesma porta, e pela mesma razão** (12 §9.1): um
 * monitor externo não tem sessão. Se a verificação de saúde passasse por
 * aqui, levava um 307 para `/entrar` — e um monitor lê um redirect como "a
 * app respondeu", ou seja, continuaria a dizer verde com a base de dados em
 * baixo. Um alarme que nunca toca é pior do que não ter alarme.
 */
export const config = {
  matcher: [
    // `maplibre/`: o worker do mapa, servido de `public/` com CSP própria (next.config.ts).
    "/((?!_next/static|_next/image|favicon.ico|%5F%5Ftempo|api/stripe/webhook|api/health|maplibre/).*)",
  ],
};
