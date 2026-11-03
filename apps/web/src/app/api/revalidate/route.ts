import { revalidateTag } from "next/cache";
import { z } from "zod";
import { isSiteCacheTag, segredoConfere } from "@upm/config/site-cache";

/**
 * `POST /api/revalidate` — as outras apps pedem ao `www` que invalide a sua
 * cache (F2 · D61). Ver `packages/config/site-cache.ts`.
 *
 * Fica fora do middleware (o matcher exclui `api/`): não tem idioma nem sessão.
 * Quem chama prova-se pelo segredo partilhado, e as etiquetas só podem ser as
 * da lista fechada — um segredo vazado invalida cache, que é o pior que faz, e
 * nem isso fora dela.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const corpoSchema = z.object({ tags: z.array(z.string().max(220)).min(1).max(50) });

export async function POST(request: Request) {
  const segredo = process.env.SITE_REVALIDATE_SECRET;
  // Sem segredo configurado a rota não existe, em vez de aceitar qualquer um.
  if (!segredo) return Response.json({ error: "not_configured" }, { status: 503 });
  if (!segredoConfere(request.headers.get("authorization"), segredo)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = corpoSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_body" }, { status: 400 });
  const fora = parsed.data.tags.filter((tag) => !isSiteCacheTag(tag));
  if (fora.length) return Response.json({ error: "unknown_tags", tags: fora }, { status: 400 });

  for (const tag of parsed.data.tags) revalidateTag(tag);
  return Response.json({ revalidated: parsed.data.tags.length });
}
