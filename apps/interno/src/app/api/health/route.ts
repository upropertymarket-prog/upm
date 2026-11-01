import { checkHealth, healthResponse } from "@upm/db/health";

/**
 * `/api/health` do `interno` — 12 §9.1, bloqueador B2.
 *
 * Fora do matcher do middleware, e aqui com uma razão a mais: o `interno` tem
 * a allowlist de IP a correr **antes do próprio login** (07 §6). Com ela
 * ativa, um monitor externo — que por definição não está na rede da equipa —
 * receberia 403 e reportaria a app em baixo, todos os minutos, para sempre.
 *
 * Deixar a saúde de fora da allowlist é deliberado e não abre nada: a
 * resposta é `{ ok: true }` ou `{ ok: false }`, sem dizer o que falhou.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return healthResponse(await checkHealth(), "interno");
}
