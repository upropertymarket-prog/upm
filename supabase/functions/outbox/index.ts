import { createClient } from "jsr:@supabase/supabase-js@2";

import { drainOutbox, errorText, type OutboundEmail } from "../_shared/outbox-core.ts";

/**
 * Entrega a fila de e-mails no pré-lançamento (7 nov 2026)
 * =========================================================================
 * O e-mail de confirmação da pré-inscrição entra em `notification_deliveries`
 * e era o `mail-worker` que o levava ao Resend. O worker é um processo sempre
 * ligado e precisava de alojamento próprio só para isto, já que a leitura das
 * caixas do Suporte é do lançamento oficial. Decisão do cliente: entregar a
 * fila a partir do Supabase.
 *
 * O `pg_cron` chama esta função de minuto a minuto, e só quando há alguma coisa
 * em fila (`20261107090000_outbox_pelo_supabase.sql`). As regras (marcar antes
 * de enviar, cinco tentativas, recuperar o que ficou preso, idempotência) são
 * as de `_shared/outbox-core.ts`, as mesmas do worker.
 *
 * **Quem a pode chamar.** `verify_jwt = false` em `config.toml`, porque a
 * chave pública também é um JWT válido e qualquer visitante a tem: com a
 * verificação do Supabase, qualquer pessoa disparava a fila. Em vez disso, um
 * segredo próprio (`OUTBOX_CRON_SECRET`), que só o `pg_cron` conhece — lê-o do
 * Vault — e que se compara em tempo constante.
 *
 * Ambiente (segredos das Edge Functions, no painel do Supabase):
 *  - `OUTBOX_CRON_SECRET` — o mesmo que está no Vault como `outbox_cron_secret`;
 *  - `RESEND_API_KEY`;
 *  - `MAIL_FROM` — o remetente, de um domínio verificado no Resend;
 *  - `APP_URL` — base dos links relativos (os da pré-inscrição já são absolutos);
 *  - `SITE_URL` (opcional) — o site de onde vem a imagem da assinatura; sem
 *    ele, `https://upropertymarket.pt`.
 * `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são postos pelo próprio Supabase.
 */

const LOTE = 20;

function iguais(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diferenca = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diferenca |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diferenca === 0;
}

Deno.serve(async (request) => {
  const segredo = Deno.env.get("OUTBOX_CRON_SECRET") ?? "";
  const recebido = request.headers.get("x-outbox-secret") ?? "";
  // Sem segredo configurado, recusa: uma função aberta por esquecimento é
  // pior do que uma fila parada, que se vê.
  if (segredo.length < 32 || !iguais(recebido, segredo)) {
    return new Response("Proibido.", { status: 403 });
  }

  const chave = Deno.env.get("RESEND_API_KEY");
  if (!chave) {
    return Response.json({ reason: "RESEND_API_KEY não está definida." }, { status: 503 });
  }
  const remetente = Deno.env.get("MAIL_FROM") ?? "onboarding@resend.dev";

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const enviar = async (email: OutboundEmail) => {
    const resposta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chave}`,
        "Content-Type": "application/json",
        "Idempotency-Key": email.idempotencyKey,
      },
      body: JSON.stringify({
        from: remetente,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    });
    if (!resposta.ok) {
      throw new Error(`Resend ${resposta.status}: ${(await resposta.text()).slice(0, 300)}`);
    }
  };

  try {
    const relatorio = await drainOutbox(db, enviar, {
      batch: LOTE,
      appUrl: Deno.env.get("APP_URL") ?? "",
      // De onde vem a imagem da assinatura; por omissão, o domínio de produção.
      siteUrl: Deno.env.get("SITE_URL") ?? undefined,
    });
    if (relatorio.failed > 0) console.error("[outbox] entregas falhadas", relatorio);
    return Response.json(relatorio);
  } catch (erro) {
    console.error("[outbox]", errorText(erro));
    return Response.json({ error: errorText(erro) }, { status: 500 });
  }
});
