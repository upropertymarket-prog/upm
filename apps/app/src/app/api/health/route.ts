import { checkHealth, healthResponse } from "@upm/db/health";

/**
 * `/api/health` da `app` — 12 §9.1, bloqueador B2.
 *
 * **Fica fora do matcher do middleware** (ver `middleware.ts`), pela mesma
 * razão do webhook do Stripe: o guard de sessão redirecionaria o pedido para
 * `/entrar` com um 307, e um monitor leria esse redirect como "a app está
 * viva" — mesmo com a base de dados em baixo. Um alarme que nunca toca é pior
 * do que não ter alarme.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return healthResponse(await checkHealth(), "app");
}
