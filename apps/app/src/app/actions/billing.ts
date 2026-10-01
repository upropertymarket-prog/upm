"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@upm/db/server";
import { billingIntervalSchema } from "@upm/db/billing";
import { getStripeClient } from "@upm/db/stripe";

/**
 * Faturação — Server Actions (P7-02)
 * =========================================================================
 * Duas regras que atravessam este ficheiro:
 *
 * 1. **O preço vem do catálogo, nunca do pedido.** O cliente diz "quero o
 *    plano `smarter-owner`, anual"; é o servidor que vai a `plans` buscar o
 *    `stripe_price_year_id`. Aceitar um `price_id` do browser seria deixar
 *    alguém subscrever o Premium ao preço do Essential.
 * 2. **Nada escreve em `subscriptions`.** O estado da subscrição é do Stripe e
 *    chega por webhook (P7-03). Uma action que o escrevesse estaria a adivinhar
 *    o resultado de um pagamento que ainda não aconteceu.
 */

export type CheckoutState = { url?: string; error?: string };

const checkoutSchema = z.object({
  kind: z.enum(["plan", "addon"]),
  slug: z.string().min(1).max(64),
  interval: billingIntervalSchema,
});

async function session() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function appUrl() {
  return process.env.APP_URL ?? "http://localhost:4301";
}

/**
 * Garante um `customer` no Stripe para este perfil. O id guarda-se em
 * `profiles.stripe_customer_id`, que a sessão já não pode escrever (migração
 * `20261001120100`) — por isso a escrita passa pela RPC `attach_stripe_customer`,
 * que só aceita preencher quando ainda está vazio.
 */
async function ensureCustomer(
  supabase: Awaited<ReturnType<typeof session>>["supabase"],
  userId: string,
  email: string | undefined,
): Promise<{ customerId?: string; error?: string }> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, full_name")
    .eq("id", userId)
    .single();

  if (profile?.stripe_customer_id) return { customerId: profile.stripe_customer_id };

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email,
    name: profile?.full_name || undefined,
    metadata: { upm_profile_id: userId },
  });

  const { error } = await supabase.rpc("attach_stripe_customer", {
    p_customer_id: customer.id,
  });
  if (error) return { error: "Não foi possível preparar a faturação." };

  return { customerId: customer.id };
}

/**
 * Abre o Stripe Checkout (`mode=subscription`, 02 §9) e devolve o URL. O
 * `redirect` é do lado do cliente, para a action poder devolver erro em vez de
 * atirar uma navegação a meio.
 */
export async function startCheckout(input: unknown): Promise<CheckoutState> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return { error: "Pedido inválido." };
  const { kind, slug, interval } = parsed.data;

  const { supabase, user } = await session();
  if (!user) return { error: "Sessão inválida." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || (profile.role !== "owner" && profile.role !== "buyer")) {
    return { error: "Sessão inválida." };
  }

  const column = interval === "month" ? "stripe_price_month_id" : "stripe_price_year_id";

  if (kind === "plan") {
    const { data: plan } = await supabase
      .from("plans")
      .select(`slug, audience, price_month_cents, price_year_cents, ${column}`)
      .eq("slug", slug)
      .eq("visible", true)
      .maybeSingle();

    if (!plan) return { error: "Plano indisponível." };

    // 05 §6.6: um proprietário não subscreve um plano de comprador.
    if (plan.audience !== "both" && plan.audience !== profile.role) {
      return { error: "Esse plano não é do seu perfil." };
    }
    if (plan.price_month_cents === 0 && plan.price_year_cents === 0) {
      return { error: "O plano Gratuito não passa por pagamento." };
    }

    const priceId = (plan as Record<string, unknown>)[column];
    if (typeof priceId !== "string" || priceId.length === 0) {
      return { error: "Este plano ainda não está disponível para subscrição." };
    }
    return checkoutFor(supabase, user.id, user.email, priceId, { upm_plan_slug: slug });
  }

  const { data: addon } = await supabase
    .from("addons")
    .select(`slug, ${column}`)
    .eq("slug", slug)
    .eq("visible", true)
    .maybeSingle();

  if (!addon) return { error: "Extra indisponível." };

  const priceId = (addon as Record<string, unknown>)[column];
  if (typeof priceId !== "string" || priceId.length === 0) {
    return { error: "Este extra ainda não está disponível." };
  }
  return checkoutFor(supabase, user.id, user.email, priceId, { upm_addon_slug: slug });
}

async function checkoutFor(
  supabase: Awaited<ReturnType<typeof session>>["supabase"],
  userId: string,
  email: string | undefined,
  priceId: string,
  metadata: Record<string, string>,
): Promise<CheckoutState> {
  try {
    const { customerId, error } = await ensureCustomer(supabase, userId, email);
    if (error || !customerId) return { error: error ?? "Não foi possível preparar a faturação." };

    const stripe = getStripeClient();
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl()}/plano?checkout=sucesso`,
      cancel_url: `${appUrl()}/plano?checkout=cancelado`,
      // Fatura com NIF opcional (02 §9). A emissão certificada em PT é outra
      // coisa e continua por decidir (07 §9 #4).
      tax_id_collection: { enabled: true },
      billing_address_collection: "auto",
      metadata: { upm_profile_id: userId, ...metadata },
      subscription_data: { metadata: { upm_profile_id: userId, ...metadata } },
    });

    if (!checkout.url) return { error: "Não foi possível abrir o pagamento." };
    return { url: checkout.url };
  } catch {
    // 08 §3.6: nada de detalhes internos na resposta ao cliente.
    return { error: "Não foi possível abrir o pagamento. Tente novamente." };
  }
}

/** Customer Portal: cartão, cancelamento e histórico (02 §9). */
export async function openBillingPortal(): Promise<CheckoutState> {
  const { supabase, user } = await session();
  if (!user) return { error: "Sessão inválida." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  // Nunca se aceita um `customer` vindo do cliente: é sempre o da sessão.
  if (!profile?.stripe_customer_id) {
    return { error: "Ainda não há faturação associada a esta conta." };
  }

  try {
    const stripe = getStripeClient();
    const portal = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${appUrl()}/plano`,
    });
    return { url: portal.url };
  } catch {
    return { error: "Não foi possível abrir o portal de faturação." };
  }
}
