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

  const db = createServiceClient();

  // A chave primária é o `event.id`: se já lá estiver, este envio é repetido.
  const claim = await db
    .from("stripe_events")
    .insert({ id: event.id, type: event.type })
    .select("id")
    .maybeSingle();

  if (claim.error) {
    // Violação de chave primária = evento já recebido. Qualquer outro erro é
    // problema nosso, e aí vale a pena o Stripe repetir.
    if (claim.error.code === "23505") return Response.json({ received: true, duplicate: true });
    return new Response("Erro a registar o evento.", { status: 500 });
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
    // O evento fica marcado como falhado E a linha é apagada, para o reenvio
    // do Stripe poder voltar a tentar. Guardar a falha e bloquear o reenvio
    // seria perder a alteração para sempre.
    const message = error instanceof Error ? error.message : "erro desconhecido";
    await db.from("stripe_events").update({ status: "failed", error: message }).eq("id", event.id);
    await db.from("stripe_events").delete().eq("id", event.id);
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
  // que já estava, e só os extras se atualizam.
  const { data: existing } = await db
    .from("subscriptions")
    .select("id, plan_id")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();

  const planId = plan?.id ?? existing?.plan_id ?? (await freePlanId(db));

  const row = {
    profile_id: profileId,
    plan_id: planId,
    stripe_subscription_id: subscription.id,
    status,
    interval,
    current_period_end: periodEnd,
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    trial_ends_at: secondsToIso(subscription.trial_end),
  };

  const { data: saved, error } = await db
    .from("subscriptions")
    .upsert(row, { onConflict: "stripe_subscription_id" })
    .select("id")
    .single();
  if (error) throw new Error(`subscriptions: ${error.message}`);

  await applyAddons(db, saved.id, subscription, status, interval);

  // 07 §19.1: ao ganhar Cloud, as pastas de todas as propriedades nascem de
  // uma vez. Chamar isto quando não há Cloud é inofensivo — a função verifica.
  if (status === "active" || status === "trialing") {
    await db.rpc("ensure_property_folders", { p_profile_id: profileId });
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

async function freePlanId(db: ServiceClient) {
  const { data } = await db.from("plans").select("id").eq("slug", "gratuito").single();
  if (!data) throw new Error("Plano Gratuito em falta no catálogo");
  return data.id;
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
