import type Stripe from "stripe";
import { createServiceClient, getStripeClient } from "@upm/db/stripe";
import {
  refId,
  secondsToIso,
  subscriptionIdFromInvoice,
  toSubscriptionStatus,
} from "@upm/db/billing";

/**
 * Webhook do Stripe — `/api/stripe/webhook` (P7-03)
 * =========================================================================
 * **Desvio declarado a 02 §9**, que desenhava isto como Edge Function da
 * Supabase. O repositório não tem toolchain Deno e as três apps são Next.js;
 * um Route Handler mantém um só runtime, um só conjunto de testes e o mesmo
 * `zod`. Decidido com o cliente a 1 out 2026 — patch a 02 §9 registado em 07.
 *
 * Em dev:
 *   stripe listen --forward-to localhost:4301/api/stripe/webhook
 *
 * Três invariantes:
 *
 * 1. **Assinatura verificada** antes de olhar para o corpo. Sem isso, qualquer
 *    um podia ativar-se um plano com um `curl`.
 * 2. **Idempotência por `event.id`** (`stripe_events`): o Stripe repete o
 *    envio de tudo o que não responda 2xx, e repetir um `invoice.paid` não
 *    pode dar duas faturas.
 * 3. **Responder 2xx mesmo quando o evento não interessa.** Um 4xx a um
 *    evento que ignoramos faz o Stripe tentar durante dias.
 *
 * Quem escreve aqui é a `service_role` — não passa por RLS. É de propósito: as
 * tabelas de faturação não têm caminho de escrita a partir de sessão nenhuma.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ServiceClient = ReturnType<typeof createServiceClient>;

/** Os eventos que mudam alguma coisa. O resto regista-se como `ignored`. */
const HANDLED = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]);

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) {
    return new Response("Assinatura em falta.", { status: 400 });
  }

  const stripe = getStripeClient();
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch {
    // 08 §3.6: a resposta não diz porquê. O detalhe fica no log do servidor.
    return new Response("Assinatura inválida.", { status: 400 });
  }

  // `createServiceClient` atira quando falta `SUPABASE_SERVICE_ROLE_KEY`, e
  // isso tem de se ver: sem este `catch`, uma variável em falta saía como um
  // 500 sem explicação nenhuma e o Stripe tentava durante dias. Aconteceu na
  // primeira verificação com o `stripe listen` — foi por isso que passou a
  // estar aqui.
  let db: ServiceClient;
  try {
    db = createServiceClient();
  } catch (error) {
    console.error(
      `[stripe-webhook] configuração incompleta: ${
        error instanceof Error ? error.message : "erro desconhecido"
      }`,
    );
    return new Response("Webhook mal configurado.", { status: 500 });
  }

  // A chave primária é o `event.id`: se já lá estiver, este envio é repetido.
  const claim = await db
    .from("stripe_events")
    .insert({ id: event.id, type: event.type })
    .select("id")
    .maybeSingle();

  if (claim.error) {
    if (claim.error.code !== "23505") {
      return new Response("Erro a registar o evento.", { status: 500 });
    }

    // Já foi recebido. Se ficou em `failed`, o reenvio do Stripe é a segunda
    // oportunidade e deixa-se passar; se já foi tratado, não se repete.
    //
    // A primeira versão apagava a linha ao falhar, para o reenvio poder voltar
    // a entrar — e com ela apagava a razão da falha, que é precisamente o que
    // se quer ler depois. Manter a linha dá as duas coisas.
    const { data: seen } = await db
      .from("stripe_events")
      .select("status")
      .eq("id", event.id)
      .maybeSingle();

    if (seen?.status !== "failed") {
      return Response.json({ received: true, duplicate: true });
    }

    await db.from("stripe_events").update({ status: "received", error: null }).eq("id", event.id);
  }

  if (!HANDLED.has(event.type)) {
    await db
      .from("stripe_events")
      .update({ status: "ignored", processed_at: new Date().toISOString() })
      .eq("id", event.id);
    return Response.json({ received: true, ignored: true });
  }

  try {
    await handle(db, event);
    await db
      .from("stripe_events")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("id", event.id);
    return Response.json({ received: true });
  } catch (error) {
    // A linha FICA, com a razão da falha. O 500 faz o Stripe reenviar, e o
    // reenvio é aceite porque o estado é `failed` (ver o `claim` acima). É o
    // que dá, ao mesmo tempo, segunda oportunidade e diagnóstico.
    const message = error instanceof Error ? error.message : "erro desconhecido";
    await db
      .from("stripe_events")
      .update({ status: "failed", error: message.slice(0, 500) })
      .eq("id", event.id);
    console.error(`[stripe-webhook] ${event.type} ${event.id}: ${message}`);
    return new Response("Erro a processar o evento.", { status: 500 });
  }
}

async function handle(db: ServiceClient, event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      // A sessão completa não traz o estado final da subscrição; o
      // `customer.subscription.created` que vem a seguir traz. Aqui só se
      // garante que o `customer` fica ligado ao perfil, para o caso de o
      // Checkout ter criado um cliente que a app ainda não conhecia.
      const session = event.data.object as Stripe.Checkout.Session;
      const profileId = session.metadata?.upm_profile_id;
      const customerId = refId(session.customer);
      if (profileId && customerId) {
        await db
          .from("profiles")
          .update({ stripe_customer_id: customerId })
          .eq("id", profileId)
          .is("stripe_customer_id", null);
      }
      return;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await applySubscription(db, event.data.object as Stripe.Subscription);
      return;

    case "invoice.paid":
    case "invoice.payment_failed":
      await applyInvoice(db, event.data.object as Stripe.Invoice);
      return;
  }
}

async function profileFor(db: ServiceClient, customerId: string | null, metaProfile?: string) {
  if (metaProfile) return metaProfile;
  if (!customerId) return null;
  const { data } = await db
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Traz uma subscrição do Stripe para `subscriptions` + `subscription_addons`.
 *
 * Um `line item` por preço: o do plano identifica-se por existir uma linha em
 * `plans` com esse `stripe_price_*_id`; os restantes procuram-se em `addons`.
 * Nada se infere por nome — é sempre o id do preço a decidir.
 */
async function applySubscription(db: ServiceClient, subscription: Stripe.Subscription) {
  const customerId = refId(subscription.customer);
  const profileId = await profileFor(
    db,
    customerId,
    subscription.metadata?.upm_profile_id ?? undefined,
  );
  if (!profileId) throw new Error(`Sem perfil para o cliente ${customerId}`);

  const status = toSubscriptionStatus(subscription.status);
  const items = subscription.items.data;
  const priceIds = items.map((item) => item.price.id);

  const { data: plans } = await db
    .from("plans")
    .select("id, stripe_price_month_id, stripe_price_year_id")
    .or(
      `stripe_price_month_id.in.(${priceIds.join(",")}),stripe_price_year_id.in.(${priceIds.join(",")})`,
    );

  const planItem = items.find((item) =>
    (plans ?? []).some(
      (plan) =>
        plan.stripe_price_month_id === item.price.id || plan.stripe_price_year_id === item.price.id,
    ),
  );

  const plan = planItem
    ? (plans ?? []).find(
        (row) =>
          row.stripe_price_month_id === planItem.price.id ||
          row.stripe_price_year_id === planItem.price.id,
      )
    : undefined;

  const interval = planItem?.price.recurring?.interval === "month" ? "month" : "year";
  const periodEnd = secondsToIso(
    planItem?.current_period_end ?? items[0]?.current_period_end ?? null,
  );

  // Sem linha de plano, isto é uma subscrição só de extras — o plano fica o
  // que já estava e, se nunca houve nenhum, fica a `null`.
  //
  // Fase 9 (P9-05): antes disto, uma subscrição sem plano caía no Gratuito,
  // porque `plan_id` era `not null` e tinha de apontar para algum lado. O
  // Gratuito deixou de existir na escada e `plan_id` passou a aceitar `null`,
  // que é o que isto realmente é: extras sem plano.
  const { data: existing } = await db
    .from("subscriptions")
    .select("id, plan_id")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();

  const planId = plan?.id ?? existing?.plan_id ?? null;

  const row = {
    profile_id: profileId,
    plan_id: planId,
    stripe_subscription_id: subscription.id,
    status,
    interval,
    current_period_end: periodEnd,
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    trial_ends_at: secondsToIso(subscription.trial_end),
    // P9-03 — a subscrição guarda a versão dos Termos com que foi contratada.
    // Os metadados são escritos por nós no Checkout (registo e `/plano`), por
    // isso são de confiança; o `??` cobre as subscrições criadas no Stripe à
    // mão, que não os trazem.
    ...(subscription.metadata?.upm_terms_document_id
      ? { terms_document_id: subscription.metadata.upm_terms_document_id }
      : {}),
    ...(subscription.metadata?.upm_terms_version
      ? { terms_version: subscription.metadata.upm_terms_version }
      : {}),
  };

  const { data: saved, error } = await db
    .from("subscriptions")
    // `as never`: `plan_id` nullable e as colunas de P9-03 só entram nos tipos
    // depois de `pnpm db:types` correr sobre as migrações desta fase.
    .upsert(row as never, { onConflict: "stripe_subscription_id" })
    .select("id")
    .single();
  if (error) throw new Error(`subscriptions: ${error.message}`);

  await applyAddons(db, saved.id, subscription, status, interval);

  // 07 §19.1: ao ganhar Cloud, as pastas de todas as propriedades nascem de
  // uma vez. Chamar isto quando não há Cloud é inofensivo — a função verifica.
  if (status === "active" || status === "trialing") {
    await db.rpc("ensure_property_folders", { p_profile_id: profileId });

    // D58 / doc 13 — o contrato de adesão escreve-se quando a subscrição fica
    // ativa, não no ecrã de contratação: antes do pagamento há proposta, depois
    // há contrato. A função é idempotente, o que importa porque o Stripe repete
    // eventos; e congela preço, plano e limites, em vez de os ler de `plans`,
    // que o Admin edita.
    //
    // `as never`: a função só entra em `database.types.ts` depois de
    // `pnpm db:types` correr sobre esta migração (D52).
    const { error: agreementError } = await db.rpc(
      "record_subscription_agreement" as never,
      { p_subscription_id: saved.id } as never,
    );
    // Não deita o webhook abaixo: a subscrição já está gravada e o Stripe não
    // deve reenviar por causa disto. Fica o rasto para se poder recuperar.
    if (agreementError) {
      console.error("record_subscription_agreement", agreementError.message);
    }
  }

  // 02 §9: o downgrade é efetivo no fim do período e os excedentes passam a
  // rascunho, nunca apagados.
  if (status === "canceled" || status === "past_due") {
    await db.rpc("apply_plan_downgrade", { p_profile_id: profileId });
  }

  // 08 §6.7: toda a alteração de plano fica no registo.
  await db.from("audit_log").insert({
    actor_id: null,
    action: `stripe.subscription.${status}`,
    entity: "subscriptions",
    entity_id: saved.id,
    diff: { plan_id: planId, status, interval },
  });
}

async function applyAddons(
  db: ServiceClient,
  subscriptionId: string,
  subscription: Stripe.Subscription,
  status: string,
  interval: string,
) {
  const priceIds = subscription.items.data.map((item) => item.price.id);
  if (priceIds.length === 0) return;

  const { data: addons } = await db
    .from("addons")
    .select("id, stripe_price_month_id, stripe_price_year_id")
    .or(
      `stripe_price_month_id.in.(${priceIds.join(",")}),stripe_price_year_id.in.(${priceIds.join(",")})`,
    );

  const active = new Set<string>();

  for (const item of subscription.items.data) {
    const addon = (addons ?? []).find(
      (row) =>
        row.stripe_price_month_id === item.price.id || row.stripe_price_year_id === item.price.id,
    );
    if (!addon) continue;
    active.add(addon.id);

    await db.from("subscription_addons").upsert(
      {
        subscription_id: subscriptionId,
        addon_id: addon.id,
        status,
        interval,
        current_period_end: secondsToIso(item.current_period_end),
        cancel_at_period_end: subscription.cancel_at_period_end ?? false,
        stripe_subscription_item_id: item.id,
      },
      { onConflict: "subscription_id,addon_id" },
    );
  }

  // Um extra que saiu da subscrição deixa de dar quota. Marca-se cancelado em
  // vez de se apagar: o histórico de quem teve o quê é dado de faturação.
  const { data: current } = await db
    .from("subscription_addons")
    .select("id, addon_id")
    .eq("subscription_id", subscriptionId);

  for (const row of current ?? []) {
    if (!active.has(row.addon_id)) {
      await db.from("subscription_addons").update({ status: "canceled" }).eq("id", row.id);
    }
  }
}

/** Espelha a fatura (05 §6.6). A verdade continua a ser a do Stripe. */
async function applyInvoice(db: ServiceClient, invoice: Stripe.Invoice) {
  const customerId = refId(invoice.customer);
  const profileId = await profileFor(db, customerId);
  if (!profileId) throw new Error(`Sem perfil para o cliente ${customerId}`);

  const subscriptionId = subscriptionIdFromInvoice(invoice);
  let localSubscriptionId: string | null = null;
  if (subscriptionId) {
    const { data } = await db
      .from("subscriptions")
      .select("id")
      .eq("stripe_subscription_id", subscriptionId)
      .maybeSingle();
    localSubscriptionId = data?.id ?? null;
  }

  const { error } = await db.from("invoices").upsert(
    {
      profile_id: profileId,
      subscription_id: localSubscriptionId,
      stripe_invoice_id: invoice.id!,
      number: invoice.number,
      total_cents: invoice.total,
      currency: invoice.currency,
      status: invoice.status ?? "open",
      hosted_url: invoice.hosted_invoice_url ?? null,
      pdf_url: invoice.invoice_pdf ?? null,
      issued_at: secondsToIso(invoice.created),
    },
    { onConflict: "stripe_invoice_id" },
  );
  if (error) throw new Error(`invoices: ${error.message}`);
}
