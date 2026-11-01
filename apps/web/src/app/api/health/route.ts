import { checkHealth, healthResponse } from "@upm/db/health";

/**
 * `/api/health` do `www` — 12 §9.1, bloqueador B2.
 *
 * O corpo vive em `@upm/db/health`, partilhado pelas três apps: uma
 * verificação de saúde que difere entre apps é uma verificação em que não se
 * confia.
 */
export const runtime = "nodejs";

/**
 * `force-dynamic` e `revalidate = 0`: uma verificação de saúde guardada em
 * cache é uma fotografia de quando as coisas estavam bem — exatamente o que
 * não se quer ler quando se está a perguntar se ainda estão.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return healthResponse(await checkHealth(), "web");
}
