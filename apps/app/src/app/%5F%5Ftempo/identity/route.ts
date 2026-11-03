import { tempoHostIdentity } from "tempo-sdk/nextjs";

// D9 (08 §9, Fase 1) — o `tempoNextjsPlugin` só regista o loader de
// anotação em webpack/turbopack; a rota de identidade que a Canvas usa para
// confirmar que este servidor é um host Tempo ativo tem de ser exposta pela
// própria app. Espelha `tempo/app/__tempo/identity/route.ts`, o sidecar
// gerado pelo `canvas_project_init`.
export const dynamic = "force-dynamic";

export function GET() {
  // Só em desenvolvimento, que é onde o Tempo a usa. Em produção responderia
  // a qualquer pessoa com a versão do SDK e a framework — pouco, mas é ajudar
  // quem anda a identificar a stack, e não serve a ninguém (12 §30).
  if (process.env.NODE_ENV === "production") {
    return new Response(null, { status: 404 });
  }
  return Response.json(tempoHostIdentity(), {
    headers: {
      "cache-control": "no-store",
      "x-tempo-host-identity": "1",
    },
  });
}
