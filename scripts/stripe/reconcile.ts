#!/usr/bin/env tsx
/**
 * Conciliação diária entre o Stripe e o Postgres (12 §7.2).
 *
 * Uso:
 *   set -a && . .secrets/stripe.env && . .secrets/supabase.env && set +a
 *   pnpm stripe:reconcile
 *
 * Precisa de `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e
 * `STRIPE_SECRET_KEY` — nenhuma vai para o browser (08 §6.1).
 *
 * ## Porque é que isto existe
 *
 * O estado de uma subscrição vive de eventos: o Stripe envia, o webhook
 * escreve. Um evento que não chega deixa as duas pontas a discordar **em
 * silêncio** — e o sintoma é um cliente que pagou e não entra, ou um que
 * cancelou e continua a entrar. Nenhum dos dois dá erro em lado nenhum.
 *
 * O webhook já regista o que falhou (`stripe_events.status = 'failed'`). O que
 * ninguém vê é o que **nunca chegou**: uma indisponibilidade nossa, um reenvio
 * que esgotou as tentativas, uma alteração feita à mão no painel do Stripe.
 *
 * ## Não corrige nada, de propósito
 *
 * Produz a lista e sai com código 1 se houver divergências que afetem o
 * acesso. Corrigir automaticamente uma divergência de faturação é como
 * corrigir automaticamente um extrato bancário: o que se quer é que **alguém
 * olhe**, decida, e saiba porque é que decidiu assim.
 *
 * ## Como correr isto todos os dias
 *
 * Não leva agendador aqui dentro. O `pg_cron` não serve — não alcança a API do
 * Stripe —, por isso é uma tarefa agendada de fora: um workflow do GitHub com
 * `schedule`, ou o que o alojamento oferecer quando existir. Fica por ligar
 * até haver chaves de produção (12 §25, C9).
 */
import {
  reconcileSubscriptions,
  type Divergencia,
  type SubscricaoLocal,
  type SubscricaoStripe,
} from "../../packages/db/src/billing-reconcile";
import { toSubscriptionStatus } from "../../packages/db/src/billing";
import { createServiceClient, getStripeClient, isTestMode } from "../../packages/db/src/stripe";

/**
 * Uma linha por divergência, para quem lê isto numa consola.
 *
 * Vive aqui e não em `@upm/db`: a comparação é regra de negócio e testa-se
 * sem rede; isto é apresentação, e um ecrã do Admin — se um dia existir —
 * escreveria "não existe" de outra maneira. O registo leva `null`; é quem
 * mostra que decide o símbolo.
 */
function formatDivergencia(d: Divergencia): string {
  const quem = d.customerEmail ?? d.profileId ?? "—";
  const marca = d.afetaAcesso ? "!" : " ";
  const lado = (valor: string | null) => valor ?? "—";
  return (
    `${marca} ${d.tipo.padEnd(24)} ${d.stripeSubscriptionId.padEnd(30)} ${quem}\n` +
    `    stripe=${lado(d.stripe)}  postgres=${lado(d.postgres)}`
  );
}

/** Em segundos, como o Stripe os dá. */
const paraIso = (segundos: number | null | undefined): string | null =>
  typeof segundos === "number" ? new Date(segundos * 1000).toISOString() : null;

async function lerDoStripe(): Promise<SubscricaoStripe[]> {
  const stripe = getStripeClient();
  const todas: SubscricaoStripe[] = [];

  // `status: "all"` e não só as ativas: metade das divergências que interessam
  // são precisamente as que o Stripe já não considera ativas e nós sim.
  for await (const sub of stripe.subscriptions.list({
    status: "all",
    limit: 100,
    expand: ["data.customer"],
  })) {
    const customer = sub.customer;
    const email =
      customer && typeof customer === "object" && !("deleted" in customer && customer.deleted)
        ? ((customer as { email?: string | null }).email ?? null)
        : null;

    todas.push({
      stripeSubscriptionId: sub.id,
      customerEmail: email,
      status: toSubscriptionStatus(sub.status),
      currentPeriodEnd: paraIso(
        (sub as unknown as { current_period_end?: number }).current_period_end,
      ),
      cancelAtPeriodEnd: sub.cancel_at_period_end === true,
    });
  }

  return todas;
}

async function lerDoPostgres(): Promise<SubscricaoLocal[]> {
  const client = createServiceClient();
  const linhas: SubscricaoLocal[] = [];
  const PAGINA = 1000;

  // Em páginas: `range` em vez de um `select` sem teto, pela razão de 12
  // §10.3 — uma consulta que cresce com o negócio é uma consulta que um dia
  // deixa de responder.
  for (let inicio = 0; ; inicio += PAGINA) {
    const { data, error } = await client
      .from("subscriptions")
      .select(
        "stripe_subscription_id, profile_id, status, current_period_end, cancel_at_period_end",
      )
      .order("created_at", { ascending: true })
      .range(inicio, inicio + PAGINA - 1);

    if (error) throw new Error(`Falha a ler subscrições: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const linha of data) {
      linhas.push({
        stripeSubscriptionId: linha.stripe_subscription_id,
        profileId: linha.profile_id,
        status: toSubscriptionStatus(linha.status),
        currentPeriodEnd: linha.current_period_end,
        cancelAtPeriodEnd: linha.cancel_at_period_end,
      });
    }

    if (data.length < PAGINA) break;
  }

  return linhas;
}

/**
 * Eventos que o webhook recebeu e não conseguiu processar.
 *
 * Vai no mesmo relatório porque é a mesma pergunta — "o Stripe e nós estamos
 * de acordo?" — vista do outro lado. E porque hoje essa linha fica em `failed`
 * com a razão escrita e **ninguém é avisado** (12 §7.1).
 */
async function lerEventosFalhados(): Promise<{ id: string; type: string; error: string }[]> {
  const client = createServiceClient();
  const { data, error } = await client
    .from("stripe_events")
    .select("id, type, error")
    .eq("status", "failed")
    .order("received_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(`Falha a ler eventos: ${error.message}`);
  return (data ?? []).map((linha) => ({
    id: linha.id,
    type: linha.type,
    error: linha.error ?? "(sem razão registada)",
  }));
}

async function main() {
  // Antes do cabeçalho, e não depois: sem chave, `isTestMode()` não tem o que
  // ler e responde "LIVE". Anunciar "LIVE" quando na verdade não há chave
  // nenhuma é o pior rótulo possível — ou faz hesitar à toa, ou faz confiar.
  // `getStripeClient()` atira com a mensagem certa se faltar.
  getStripeClient();

  console.log(
    `Conciliação Stripe ↔ Postgres · modo ${isTestMode() ? "TESTE" : "LIVE"} · ${new Date().toISOString()}`,
  );

  const [doStripe, doPostgres, falhados] = await Promise.all([
    lerDoStripe(),
    lerDoPostgres(),
    lerEventosFalhados(),
  ]);

  console.log(`Stripe: ${doStripe.length} subscrições · Postgres: ${doPostgres.length} linhas`);

  const divergencias = reconcileSubscriptions(doStripe, doPostgres);
  const comAcesso = divergencias.filter((d) => d.afetaAcesso);

  if (divergencias.length === 0 && falhados.length === 0) {
    console.log("\nAs duas pontas estão de acordo, e não há eventos por processar.");
    return;
  }

  if (divergencias.length > 0) {
    console.log(
      `\n${divergencias.length} divergência(s), ${comAcesso.length} a afetar acesso (marcadas com !):\n`,
    );
    for (const d of divergencias) console.log(formatDivergencia(d));
  }

  if (falhados.length > 0) {
    console.log(`\n${falhados.length} evento(s) do Stripe em falha:\n`);
    for (const e of falhados) console.log(`  ${e.id}  ${e.type}\n    ${e.error}`);
  }

  // Código 1 só quando alguém está a perder ou a ganhar acesso indevidamente.
  // Uma data desalinhada não vale acordar ninguém — mas aparece no relatório.
  if (comAcesso.length > 0 || falhados.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((erro: unknown) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
});
