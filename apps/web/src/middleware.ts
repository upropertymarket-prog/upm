import createIntlMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";

import { NONCE_HEADER, applySecurityHeaders, generateNonce } from "@upm/config/security";

import { routing } from "./i18n/routing";
import { sharedCacheControl } from "./lib/cache-policy";
import { modoNoMiddleware } from "./lib/launch-mode-edge";
import { deveRedirecionar } from "./lib/pre-launch-gate";

const intl = createIntlMiddleware(routing);

/**
 * `www` não tem guard de sessão (site público) — nonce + CSP (08 §5, D5) e,
 * desde 20 out 2026, o encaminhamento por idioma.
 * =========================================================================
 * **A ordem importa, e é esta.** O middleware do `next-intl` é que decide a
 * resposta: ou reescreve `/termos` para `/pt/termos` por dentro, ou redireciona
 * `/` para `/en` quando o browser ou o cookie o pedem. Só depois de ele ter
 * decidido é que os cabeçalhos de segurança se aplicam — ao objeto que vai
 * sair. Aplicá-los antes deixava o `Content-Security-Policy` e o nonce de fora
 * de qualquer resposta que ele substituísse, e um redirect sem CSP é um buraco
 * silencioso em metade dos pedidos do site.
 *
 * O nonce continua a ir no **pedido**, não na resposta: é o `<ThemeScript>` do
 * layout que o lê, pelo `NONCE_HEADER`, para o script síncrono do tema poder
 * correr sob a CSP (04 §5.2).
 *
 * **E chega lá porque o `next-intl` o reencaminha.** Confirmado na fonte dele
 * (`middleware/middleware.js`): faz `new Headers(request.headers)` e devolve-os
 * em `{ request: { headers } }`, tanto no `rewrite` como no `next`. Por isso o
 * nonce entra num clone do pedido **antes** de ele decidir, em vez de ser posto
 * na resposta depois — ali já não voltava ao servidor que desenha a página.
 */
export async function middleware(request: NextRequest) {
  const nonce = generateNonce();

  /**
   * Em pré-lançamento, o site é a página de pré-lançamento (12 §34.5): o que
   * não estiver na lista de `pre-launch-gate.ts` volta para ela. Antes do
   * `intl`, para não se gastar a reescrita num pedido que não vai ser servido.
   *
   * 307 num GET — temporário, para o browser não decorar o desvio e continuar
   * a mandar para a home depois do lançamento. 303 no resto, para um `POST`
   * não ser repetido como `POST` na home.
   */
  const destino = deveRedirecionar(await modoNoMiddleware(), request.nextUrl.pathname);
  if (destino) {
    const metodoSeguro = request.method === "GET" || request.method === "HEAD";
    const desvio = NextResponse.redirect(new URL(destino, request.url), metodoSeguro ? 307 : 303);
    desvio.headers.set("Cache-Control", "no-store");
    applySecurityHeaders(desvio.headers, nonce);
    return desvio;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(NONCE_HEADER, nonce);

  const response = intl(new NextRequest(request, { headers: requestHeaders }));

  applySecurityHeaders(response.headers, nonce);

  /**
   * Cache de borda, só no que é igual para toda a gente (12 §10.4).
   *
   * **Depois do `intl` e só em respostas que ficam**, pela mesma razão que os
   * cabeçalhos de segurança: um redirect de idioma não é a página, e pôr-lhe
   * um `s-maxage` ensinaria a CDN a guardar o desvio em vez do destino.
   *
   * A lista do que pode ser partilhado está em `lib/cache-policy.ts`, e é
   * branca: o caminho que lá não estiver não leva cabeçalho nenhum.
   */
  if (response.status === 200) {
    const cache = sharedCacheControl(request.nextUrl.pathname);
    if (cache) response.headers.set("Cache-Control", cache);
  }

  return response;
}

/**
 * O que o middleware **não** vê, e porquê.
 *
 * `_next/static` e `_next/image` são servidos pelo Next e não precisam de
 * nada disto. O `%5F%5Ftempo` é a rota do próprio Tempo. Os três últimos são
 * novos e existem por causa do idioma: `robots.txt`, `sitemap.xml` e `og/`
 * ficaram **fora** do segmento `[locale]` de propósito — são do site todo, não
 * de uma língua — e deixá-los passar aqui fazia o `next-intl` tentar
 * prefixá-los, transformando `/sitemap.xml` num redirect para
 * `/pt/sitemap.xml`, que não existe. Um sitemap que responde 404 é um sitemap
 * que o Google deixa de ler.
 *
 * O último, `.*\..*`, deixa de fora **qualquer ficheiro** (um caminho com
 * extensão). Até 5 nov os de `public/` passavam aqui, o `next-intl`
 * reescrevia `/brand/icon-dark.svg` para `/pt/brand/icon-dark.svg` e a resposta
 * era 404 — visto pelo E2E do pré-lançamento. Nenhuma página do site tem um
 * ponto no caminho.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|%5F%5Ftempo|robots.txt|sitemap.xml|og/|auth/|api/|.*\\..*).*)",
  ],
};
