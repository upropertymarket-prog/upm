"use server";

import { clientIpFrom } from "@upm/config/security";
import { createHash, randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@upm/db/server";
import { checkoutSchema, invoiceIdSchema, trialReasonSchema } from "@upm/db/billing";
import { MAX_FILE_BYTES, sniffMime } from "@upm/db/cloud";
import { cancelReasonSchema } from "@upm/db/subscription";
import { getStripeClient } from "@upm/db/stripe";

/**
 * Faturação — Server Actions (P7-02 · P7-04)
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
  const { kind, slug, interval, termsDocumentId, termsContentHash } = parsed.data;

  const { supabase, user } = await session();
  if (!user) return { error: "Sessão inválida." };

  // P9-02/P9-09 — contratar exige aceitação explícita dos Termos, com a versão
  // concreta que foi mostrada. O hash é a prova de que o texto não mudou entre o
  // ecrã abrir e o botão ser premido; se mudou, a contratação para.
  //
  // Os extras não abrem contrato novo: somam-se a uma subscrição que já tem uma
  // aceitação registada (07 §19.3).
  let acceptedTerms: { id: string; version: string } | null = null;
  if (kind === "plan") {
    if (!termsDocumentId || !termsContentHash) {
      return { error: "Tem de aceitar os Termos e Condições para continuar." };
    }

    // Pelo id, não pelo idioma: a página carrega os Termos no idioma da sessão.
    const { data: terms } = await supabase
      .from("legal_documents")
      .select("id, version, content_hash")
      .eq("id", termsDocumentId)
      .eq("kind", "terms")
      .eq("status", "published")
      .maybeSingle();

    if (!terms) return { error: "Não há Termos publicados. Contacte o suporte." };
    if (terms.content_hash !== termsContentHash) {
      return { error: "Os Termos foram atualizados. Recarregue a página e leia a versão nova." };
    }

    const headerList = await headers();
    const { error: acceptError } = await supabase.rpc("record_terms_acceptance", {
      p_document_id: terms.id,
      p_context: "subscription",
      p_ip: clientIpFrom(headerList),
      p_user_agent: headerList.get("user-agent") ?? undefined,
    });
    if (acceptError) return { error: "Não foi possível registar a aceitação dos Termos." };

    acceptedTerms = { id: terms.id, version: terms.version };
  }

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
    // P9-05 — nenhum plano a 0 € pode estar visível (o `check` de
    // `plans_no_free_visible` impede-o). Esta guarda fica como rede: se algum
    // dia voltar a existir, não entra em Checkout por acidente.
    if (plan.price_month_cents === 0 && plan.price_year_cents === 0) {
      return { error: "Este plano não passa por pagamento." };
    }

    const priceId = (plan as Record<string, unknown>)[column];
    if (typeof priceId !== "string" || priceId.length === 0) {
      return { error: "Este plano ainda não está disponível para subscrição." };
    }
    // P9-05 — não há trial. O `trial_period_days` saiu daqui: a decisão do
    // cliente de 7 out 2026 é que quem se inscreve paga no momento da
    // inscrição. `trial_eligible()` continua a existir e devolve sempre false.
    return checkoutFor(supabase, user.id, user.email, priceId, {
      upm_plan_slug: slug,
      ...(acceptedTerms
        ? {
            upm_terms_document_id: acceptedTerms.id,
            upm_terms_version: acceptedTerms.version,
          }
        : {}),
    });
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
      // `customer_update` é obrigatório: a sessão leva um `customer` já criado
      // E pede o NIF (`tax_id_collection`), e o Stripe recusa essa combinação
      // sem autorização para atualizar o nome e a morada do cliente ("Tax ID
      // collection requires updating business name on the customer"). Até
      // 2 nov faltava, e a criação da sessão falhava sempre: ninguém chegava a
      // pagar — nem no registo, nem em /plano. Foi o E2E do A5 que o mostrou.
      customer_update: { name: "auto", address: "auto" },
      billing_address_collection: "auto",
      metadata: { upm_profile_id: userId, ...metadata },
      subscription_data: {
        // O webhook lê daqui a versão dos Termos e grava-a na subscrição
        // (P9-03). Sem `trial_period_days`: não há trial (P9-05).
        metadata: { upm_profile_id: userId, ...metadata },
      },
    });

    if (!checkout.url) return { error: "Não foi possível abrir o pagamento." };
    return { url: checkout.url };
  } catch (erro) {
    // 08 §3.6: nada de detalhes internos na resposta ao cliente — mas no log
    // sim. Até 2 nov este catch engolia o motivo, e uma recusa do Stripe que
    // impedia toda a gente de pagar passou sem deixar rasto em lado nenhum.
    console.error("[checkout]", erro instanceof Error ? erro.message : erro);
    return { error: "Não foi possível abrir o pagamento. Tente novamente." };
  }
}

// ---------------------------------------------------------------------------
// Cancelamento — P9-04
//
// **A decisão é da base de dados, a execução é daqui.**
// `request_subscription_cancellation()` chama `can_cancel_subscription()`, a
// única porta, e só depois de ela aceitar é que o Stripe é tocado. Nenhuma
// condição de cancelamento vive neste ficheiro — se vivesse, passavam a existir
// duas respostas possíveis à mesma pergunta (07 §20.5).
//
// Nenhum bloqueio é implementado nesta fase: hoje a porta permite sempre,
// porque não há período mínimo definido (decisão do cliente, 7 out 2026).
// ---------------------------------------------------------------------------

export type CancelState = { ok?: boolean; effectiveAt?: string | null; error?: string };

export async function cancelSubscription(
  _prev: CancelState,
  formData: FormData,
): Promise<CancelState> {
  const subscriptionId = formData.get("subscriptionId");
  if (typeof subscriptionId !== "string" || subscriptionId.length === 0) {
    return { error: "Subscrição inválida." };
  }

  const reasonResult = cancelReasonSchema.safeParse(formData.get("reason") ?? undefined);
  if (!reasonResult.success) return { error: "Motivo demasiado longo." };

  const { supabase, user } = await session();
  if (!user) return { error: "Sessão inválida." };

  const { data: decision, error } = await supabase.rpc("request_subscription_cancellation", {
    p_subscription_id: subscriptionId,
    p_reason: reasonResult.data,
  });

  if (error) {
    // O `hint` traz a razão, não o texto (mesmo contrato dos limites de plano).
    const hint = error.hint;
    if (hint === "already_requested") return { error: "O cancelamento já estava pedido." };
    if (hint === "already_canceled") return { error: "Esta subscrição já está cancelada." };
    return { error: "Não foi possível cancelar a subscrição. Tente novamente." };
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("id", subscriptionId)
    .maybeSingle();

  if (subscription?.stripe_subscription_id) {
    try {
      const stripe = getStripeClient();
      // `cancel_at_period_end`: o acesso mantém-se até ao fim do período pago,
      // como manda 02 §9. O estado final volta por webhook — não se escreve aqui.
      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
    } catch {
      // O pedido ficou registado e auditado; o que falhou foi o Stripe. Dizê-lo
      // é melhor do que deixar a pessoa a achar que cancelou.
      return {
        error:
          "O pedido ficou registado, mas não foi possível confirmá-lo junto do pagamento. Contacte o suporte.",
      };
    }
  }

  revalidatePath("/plano");
  // `Returns: Json` — a data efetiva é lida do objeto, se vier um objeto.
  const effectiveAt =
    decision && typeof decision === "object" && !Array.isArray(decision)
      ? ((decision as { effective_at?: string | null }).effective_at ?? null)
      : null;
  return { ok: true, effectiveAt };
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

// ---------------------------------------------------------------------------
// Faturas — P7-04 (04 §8.3 · 03 F8)
// ---------------------------------------------------------------------------

export type InvoiceActionState = { ok?: boolean; url?: string; error?: string };

/**
 * O PDF da fatura vive no Stripe. O URL que usamos foi escrito pelo webhook a
 * partir da API — **nunca vem num parâmetro do cliente** — e ainda assim é
 * validado contra a lista branca de 08 §7.4 antes de se lhe tocar.
 */
function isStripeUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "stripe.com" || url.hostname.endsWith(".stripe.com"))
    );
  } catch {
    return false;
  }
}

async function ownInvoice(invoiceId: string) {
  const { supabase, user } = await session();
  if (!user) return { error: "Sessão inválida." as const };

  const parsed = invoiceIdSchema.safeParse(invoiceId);
  if (!parsed.success) return { error: "Fatura inválida." as const };

  // A RLS já limita a leitura ao dono; o `eq` é o cinto a par dos suspensórios.
  const { data } = await supabase
    .from("invoices")
    .select("id, number, pdf_url, hosted_url, saved_file_id")
    .eq("id", parsed.data)
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!data) return { error: "Fatura inexistente." as const };
  return { supabase, user, invoice: data };
}

/** Exportar: abre o PDF do Stripe e deixa a linha no registo (08 §6.9). */
export async function exportInvoice(invoiceId: string): Promise<InvoiceActionState> {
  const found = await ownInvoice(invoiceId);
  if ("error" in found) return { error: found.error };
  const { supabase, invoice } = found;

  const url = invoice.pdf_url ?? invoice.hosted_url;
  if (!url || !isStripeUrl(url)) return { error: "Esta fatura ainda não tem PDF." };

  await supabase.rpc("log_invoice_access", { p_invoice_id: invoice.id, p_action: "download" });
  return { url };
}

/**
 * O nome da pasta na primeira vez. Depois disso é o utilizador que manda.
 *
 * Sem `export`: num ficheiro `"use server"` só funções `async` podem ser
 * exportadas — tudo o que daqui sai é um endpoint.
 */
const INVOICE_FOLDER_NAME = "Faturas";

/**
 * A pasta das faturas (D41): procura uma pasta de utilizador com este nome na
 * raiz da Cloud e cria-a se não existir. Procura pelo nome — e não por uma
 * marca na tabela — justamente para que renomear ou mover a pasta não a
 * "roube" ao utilizador: se ele lhe mudar o nome, a fatura seguinte cria uma
 * "Faturas" nova e ele arruma como quiser. O que não acontece é a app insistir.
 *
 * Devolve `null` quando a criação falha: a fatura vai para a raiz, que é onde
 * ia antes, em vez de não ser guardada.
 */
async function invoiceFolderId(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("folders")
    .select("id")
    .eq("owner_id", userId)
    .is("parent_id", null)
    .eq("kind", "user")
    .eq("name", INVOICE_FOLDER_NAME)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created } = await supabase
    .from("folders")
    .insert({ owner_id: userId, parent_id: null, name: INVOICE_FOLDER_NAME, kind: "user" })
    .select("id")
    .maybeSingle();
  return created?.id ?? null;
}

/**
 * Guardar na Cloud: traz o PDF do Stripe e põe-no na Cloud do próprio, pelo
 * mesmo caminho de um upload normal — `cloud_register_upload` verifica a quota
 * antes de o ficheiro contar (07 §19.8 #1), e recusa a quem não tem Cloud com
 * a mensagem que leva ao convite de 07 §19.4.
 */
export async function saveInvoiceToCloud(invoiceId: string): Promise<InvoiceActionState> {
  const found = await ownInvoice(invoiceId);
  if ("error" in found) return { error: found.error };
  const { supabase, user, invoice } = found;

  if (invoice.saved_file_id) return { error: "Esta fatura já está guardada na Cloud." };

  const url = invoice.pdf_url;
  if (!url || !isStripeUrl(url)) return { error: "Esta fatura ainda não tem PDF." };

  let bytes: Uint8Array;
  try {
    const response = await fetch(url, { redirect: "error" });
    if (!response.ok) return { error: "Não foi possível obter a fatura." };
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch {
    return { error: "Não foi possível obter a fatura." };
  }

  if (bytes.byteLength === 0 || bytes.byteLength > MAX_FILE_BYTES) {
    return { error: "A fatura não pôde ser guardada." };
  }
  // O tipo decide-se pelos bytes, como em qualquer upload (07 §19.8 #2).
  const mime = sniffMime(bytes);
  if (mime !== "application/pdf") return { error: "A fatura não pôde ser guardada." };

  const storagePath = `${user.id}/${randomUUID()}/1`;
  const { error: uploadError } = await supabase.storage
    .from("cloud")
    .upload(storagePath, bytes, { contentType: mime, upsert: false });
  if (uploadError) return { error: "Não foi possível guardar a fatura." };

  // D41 — decisão do cliente a 6 out 2026: a pasta "Faturas" nasce na primeira
  // vez que se guarda uma fatura, e só então. É `kind: "user"`, de propósito:
  // uma pasta de utilizador renomeia-se, move-se e apaga-se como qualquer
  // outra, ao contrário das pastas de sistema de 07 §19.1. É isso que a torna
  // compatível com 07 §19.9 ("a app não arruma o que é do utilizador") — ela
  // arruma a primeira, e a partir daí a pasta é de quem a tem.
  const folderId = await invoiceFolderId(supabase, user.id);

  const name = `Fatura ${invoice.number ?? invoice.id.slice(0, 8)}.pdf`;
  const { data: fileId, error: registerError } = await supabase.rpc("cloud_register_upload", {
    p_folder_id: folderId as unknown as string,
    p_name: name,
    p_mime: mime,
    p_size: bytes.byteLength,
    p_storage_path: storagePath,
    p_checksum: createHash("sha256").update(bytes).digest("hex"),
    p_source: "invoice",
  });

  if (registerError || !fileId) {
    // Recusado (sem Cloud, sem espaço): o objeto não fica no bucket a ocupar
    // espaço que ninguém contabiliza.
    await supabase.storage.from("cloud").remove([storagePath]);
    return { error: registerError?.message ?? "Não foi possível guardar a fatura." };
  }

  const { error: linkError } = await supabase.rpc("invoice_saved_to_cloud", {
    p_invoice_id: invoice.id,
    p_file_id: fileId,
  });
  if (linkError) {
    await supabase.rpc("cloud_delete_file", { p_file_id: fileId });
    await supabase.storage.from("cloud").remove([storagePath]);
    return { error: "Esta fatura já está guardada na Cloud." };
  }

  revalidatePath("/plano");
  revalidatePath("/cloud");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Trial — P7-06 (07 §8.1)
// ---------------------------------------------------------------------------

export type TrialActionState = { ok?: boolean; error?: string };

/**
 * Pedir mais 7 dias, com justificação escrita. As regras — só durante o
 * trial, só uma vez — vivem na função SQL; aqui valida-se o texto antes de
 * incomodar a base de dados e traduz-se a recusa.
 */
export async function requestTrialExtension(
  _prev: TrialActionState,
  formData: FormData,
): Promise<TrialActionState> {
  const parsed = trialReasonSchema.safeParse(formData.get("reason"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Justificação inválida." };
  }

  const { supabase, user } = await session();
  if (!user) return { error: "Sessão inválida." };

  const { error } = await supabase.rpc("request_trial_extension", { p_reason: parsed.data });
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Já pediu uma extensão — é uma única vez."
          : (error.message ?? "Não foi possível enviar o pedido."),
    };
  }

  revalidatePath("/plano");
  return { ok: true };
}
