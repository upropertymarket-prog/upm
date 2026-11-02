/**
 * O Stripe nos E2E — sempre em modo de teste, e o webhook a sério
 * =========================================================================
 * O checkout faz-se no ecrã real do Stripe, com o cartão de teste. O que não
 * se consegue em local é o Stripe **entregar** o webhook: não há endereço
 * público para onde o mandar. Em vez de o fingir na base de dados, faz-se o
 * que o Stripe faria: vai-se buscar a subscrição verdadeira à API do Stripe,
 * monta-se o evento, **assina-se com o segredo do webhook** e envia-se para
 * `/api/stripe/webhook`. Fica provado tudo — a verificação da assinatura, o
 * tratamento e a escrita na base — menos o transporte pela rede do Stripe,
 * que só o C9 (endpoint em staging) prova.
 */
import Stripe from "stripe";

import { APP, STRIPE_SECRET, STRIPE_WEBHOOK_SECRET } from "./ambiente";

let cliente: Stripe | null = null;
export function stripe(): Stripe {
  if (!STRIPE_SECRET.startsWith("sk_test_")) {
    throw new Error("Os E2E só correm com uma chave Stripe de TESTE (sk_test_).");
  }
  cliente ??= new Stripe(STRIPE_SECRET);
  return cliente;
}

/** Envia ao webhook da app um evento assinado com o segredo verdadeiro. */
export async function entregarWebhook(
  tipo: "customer.subscription.created" | "checkout.session.completed",
  objeto: unknown,
): Promise<Response> {
  const evento = {
    id: `evt_e2e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    object: "event",
    api_version: "2025-01-27.acacia",
    created: Math.floor(Date.now() / 1000),
    type: tipo,
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    data: { object: objeto },
  };
  const corpo = JSON.stringify(evento);
  const assinatura = stripe().webhooks.generateTestHeaderString({
    payload: corpo,
    secret: STRIPE_WEBHOOK_SECRET,
  });
  return fetch(`${APP}/api/stripe/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": assinatura },
    body: corpo,
  });
}

/** Cancela e apaga o cliente de teste no fim, para o Stripe de teste não acumular lixo. */
export async function limparClienteStripe(cliente: string): Promise<void> {
  const subs = await stripe().subscriptions.list({ customer: cliente, status: "all" });
  for (const s of subs.data) {
    if (s.status !== "canceled") await stripe().subscriptions.cancel(s.id);
  }
  await stripe().customers.del(cliente);
}

/** Um NIF de pessoa singular válido (dígito de controlo certo), diferente a cada chamada. */
export function nifValido(): string {
  const base = [2, ...Array.from({ length: 7 }, () => Math.floor(Math.random() * 10))];
  const soma = base.reduce((acc, d, i) => acc + d * (9 - i), 0);
  const resto = soma % 11;
  const controlo = resto < 2 ? 0 : 11 - resto;
  return [...base, controlo].join("");
}

/**
 * Conclui o pagamento de uma sessão de checkout, pela API do Stripe (teste)
 * =========================================================================
 * A página de pagamento alojada do Stripe traz os campos do cartão em iframes
 * e um hCaptcha invisível: defende-se de automação, e é código do Stripe, não
 * nosso. O que é nosso — e foi aí que o E2E encontrou o defeito de 2 nov, a
 * sessão que nunca se criava — prova-se até à porta: a app cria a sessão e
 * leva lá o cliente.
 *
 * Daí em diante faz-se pela API o que o formulário faria: o cartão de teste
 * `pm_card_visa` no mesmo cliente, e a subscrição com o preço e os metadados
 * que a sessão leva. Devolve a sessão (para o teste a verificar) e a
 * subscrição (para o webhook).
 */
export async function concluirPagamentoDeTeste(urlDoCheckout: string) {
  const id = /\/(cs_test_[A-Za-z0-9]+)/.exec(urlDoCheckout)?.[1];
  if (!id) throw new Error(`Não é uma sessão de checkout de teste: ${urlDoCheckout}`);
  const sessao = await stripe().checkout.sessions.retrieve(id, { expand: ["line_items"] });
  const cliente = typeof sessao.customer === "string" ? sessao.customer : sessao.customer?.id;
  const preco = sessao.line_items?.data[0]?.price?.id;
  if (!cliente || !preco) throw new Error("A sessão não tem cliente ou preço");

  const metodo = await stripe().paymentMethods.attach("pm_card_visa", { customer: cliente });
  await stripe().customers.update(cliente, {
    invoice_settings: { default_payment_method: metodo.id },
  });
  const subscricao = await stripe().subscriptions.create({
    customer: cliente,
    items: [{ price: preco }],
    default_payment_method: metodo.id,
    metadata: { ...(sessao.metadata ?? {}) },
  });
  return { sessao, subscricao, cliente, preco };
}
