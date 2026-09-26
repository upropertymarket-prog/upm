import { tempoHostIdentity } from "tempo-sdk/nextjs";

// D9 (08 §9, Fase 1) — o `tempoNextjsPlugin` só regista o loader de
// anotação em webpack/turbopack; a rota de identidade que a Canvas usa para
// confirmar que este servidor é um host Tempo ativo tem de ser exposta pela
// própria app. Espelha `tempo/app/__tempo/identity/route.ts`, o sidecar
// gerado pelo `canvas_project_init`.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(tempoHostIdentity(), {
    headers: {
      "cache-control": "no-store",
      "x-tempo-host-identity": "1",
    },
  });
}
