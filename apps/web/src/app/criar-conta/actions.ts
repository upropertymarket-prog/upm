"use server";

import { cookies, headers } from "next/headers";
import { createClient, createServiceClient } from "@upm/db/server";
import { getStripeClient } from "@upm/db/stripe";
import {
  GENERIC_IDENTITY_ERROR,
  checkAuthRateLimit,
  emailSchema,
  fullNameSchema,
  isPasswordPwned,
  passwordSchema,
  phoneSchema,
  recordAuthAttempt,
  roleAtRegistrationSchema,
  taxIdSchema,
} from "@upm/db/auth";
import { billingIntervalSchema } from "@upm/db/billing";
import { pendingRpc, pendingSelectOne } from "@upm/db/pending-types";

import type { RegisterState } from "./RegisterWizard";
import type { ResendState } from "./verificacao/ResendVerificationForm";

export type { RegisterState, ResendState };

/**
 * Registo com contratação paga (Fase 9 — P9-01, P9-02, P9-05, P9-09)
 * =========================================================================
 * **Decisão do cliente, 7 out 2026:** não há plano gratuito nem trial. Quem se
 * inscreve preenche os seus dados, vê o contrato, concorda com ele e paga — no
 * mesmo momento. É isso que faz deste ficheiro UMA ação e não quatro.
 *
 * Porque é numa só passagem, e não em páginas com estado pelo meio: com
 * `enable_confirmations = true` o `signUp` **não devolve sessão** (o e-mail
 * ainda não está confirmado), e uma página intermédia precisaria de carregar
 * identidade num cookie assinado ou num token na URL. Recolher tudo no cliente
 * e submeter de uma vez evita esse segredo e essa superfície: entre a criação da
 * conta e o Checkout não há nada por onde alguém entre.
 *
 * Ordem — e é a ordem da indústria para SaaS pago:
 *
 *   1. valida o input e o rate limit  (nada sai para fora antes disto)
 *   2. pergunta a elegibilidade ao servidor (P9-07)
 *   3. `signUp` — cria o utilizador, sem sessão
 *   4. grava NIF, telefone e identidade permanente (P9-01)
 *   5. registo da aceitação dos Termos, com versão, hash e IP (P9-02)
 *   6. cliente Stripe + Checkout, com a versão dos Termos nos metadados
 *   7. devolve o URL do Checkout; a verificação do e-mail segue em paralelo
 *
 * O e-mail de verificação é enviado pelo `signUp` e continua obrigatório para o
 * que depende dele (07 §5.9) — o que a inscrição paga não faz é esperar por ele
 * para cobrar, porque quem está a pagar está decidido agora.
 *
 * **Mensagem única.** Qualquer recusa de identidade devolve
 * `GENERIC_IDENTITY_ERROR`. Distinguir "NIF já usado" de "NIF inválido" era
 * confirmar a terceiros que uma pessoa concreta tem conta aqui (P9-01, 08 §7.6).
 */

type EligibilityResult = { allowed: boolean; code?: string };

async function clientIp(): Promise<string | null> {
  const list = await headers();
  const forwarded = list.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || list.get("x-real-ip") || null;
}

export async function registerAccount(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const roleResult = roleAtRegistrationSchema.safeParse(formData.get("role"));
  if (!roleResult.success) return { error: "Escolha um perfil." };

  const fullNameResult = fullNameSchema.safeParse(formData.get("fullName"));
  const emailResult = emailSchema.safeParse(formData.get("email"));
  const passwordResult = passwordSchema.safeParse(formData.get("password"));
  const taxIdResult = taxIdSchema.safeParse(formData.get("taxId"));
  const phoneResult = phoneSchema.safeParse(formData.get("phone"));

  const fieldErrors: RegisterState["fieldErrors"] = {};
  if (!fullNameResult.success) fieldErrors.fullName = "Indique o seu nome.";
  if (!emailResult.success) fieldErrors.email = "E-mail inválido.";
  if (!passwordResult.success) fieldErrors.password = "Mínimo 10 caracteres.";
  if (!taxIdResult.success) fieldErrors.taxId = "NIF inválido.";
  if (!phoneResult.success) fieldErrors.phone = "Número de telefone inválido.";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, step: "account" };

  // Plano, periodicidade e Termos — o que o passo da contratação acrescenta.
  const planSlug = formData.get("planSlug");
  const intervalResult = billingIntervalSchema.safeParse(formData.get("interval"));
  const documentId = formData.get("termsDocumentId");
  const contentHash = formData.get("termsContentHash");

  if (typeof planSlug !== "string" || planSlug.length === 0 || !intervalResult.success) {
    return { error: "Escolha um plano.", step: "plan" };
  }
  if (formData.get("acceptTerms") !== "on") {
    return { error: "Tem de aceitar os Termos e Condições para continuar.", step: "contract" };
  }
  if (typeof documentId !== "string" || typeof contentHash !== "string") {
    return {
      error: "Não foi possível confirmar os Termos. Recarregue a página.",
      step: "contract",
    };
  }

  // `!` porque a verificação acima garante que os cinco passaram — o `tsc` não
  // consegue segui-la através do objeto de erros.
  const email = emailResult.data!;
  const password = passwordResult.data!;
  const taxId = taxIdResult.data!;
  const phone = phoneResult.data!;
  const fullName = fullNameResult.data!;

  const supabase = createClient(await cookies());

  // 08 §5.1/§5.5 — antes de tentar, nunca depois.
  const rateLimit = await checkAuthRateLimit(supabase, email, "register");
  if (!rateLimit.allowed) {
    return {
      error: `Demasiadas tentativas. Tente novamente dentro de ${rateLimit.retryAfterSeconds}s.`,
    };
  }

  // 08 §7.7 — passwords vazadas (haveibeenpwned k-anonymity).
  if (await isPasswordPwned(password)) {
    return {
      fieldErrors: { password: "Esta palavra-passe apareceu em fugas de dados conhecidas." },
      step: "account",
    };
  }

  let service: ReturnType<typeof createServiceClient>;
  try {
    service = createServiceClient();
  } catch {
    return { error: "O registo está temporariamente indisponível. Tente mais tarde." };
  }

  // P9-07 — a elegibilidade decide-se no servidor, a partir de NIF, telefone e
  // e-mail. O código que vem de lá NÃO é mostrado: serve para o log.
  const { data: eligibilityRaw, error: eligibilityError } = await pendingRpc<EligibilityResult>(
    service,
    "signup_eligibility",
    { p_tax_id: taxId, p_phone: phone, p_email: email },
  );
  if (eligibilityError) return { error: "Não foi possível criar a conta. Tente novamente." };

  const eligibility = eligibilityRaw ?? { allowed: false };
  if (!eligibility.allowed) {
    await recordAuthAttempt(supabase, email, "register", false);
    return { fieldErrors: { taxId: GENERIC_IDENTITY_ERROR }, step: "account" };
  }

  // O plano e o preço vêm do catálogo, nunca do pedido (P7-02 mantém-se).
  const priceColumn =
    intervalResult.data === "month" ? "stripe_price_month_id" : "stripe_price_year_id";

  const { data: plan } = await service
    .from("plans")
    .select(`id, slug, name, audience, price_month_cents, price_year_cents, ${priceColumn}`)
    .eq("slug", planSlug)
    .eq("visible", true)
    .maybeSingle();

  if (!plan) return { error: "Plano indisponível.", step: "plan" };

  const planRow = plan as Record<string, unknown>;
  if (planRow.audience !== "both" && planRow.audience !== roleResult.data) {
    return { error: "Esse plano não é do seu perfil.", step: "plan" };
  }

  const priceId = planRow[priceColumn];
  if (typeof priceId !== "string" || priceId.length === 0) {
    // P9-05: já não existe caminho gratuito. Um plano sem `Price` sincronizado
    // é um problema de catálogo (P7-01), não uma alternativa para o utilizador.
    return { error: "Este plano ainda não está disponível para subscrição.", step: "plan" };
  }

  // O documento que lhe foi mostrado tem de estar publicado AGORA e com o
  // mesmo corpo. Procura-se pelo id, não pelo idioma: a página carrega os Termos
  // no idioma da sessão, e comparar contra um idioma fixo rejeitava quem está em
  // inglês.
  const { data: terms } = await pendingSelectOne<{
    id: string;
    version: string;
    content_hash: string;
  }>(service, "legal_documents", "id, version, content_hash", {
    id: documentId,
    kind: "terms",
    status: "published",
  });

  if (!terms || terms.content_hash !== contentHash) {
    return {
      error: "Os Termos foram atualizados. Recarregue a página e leia a versão nova.",
      step: "contract",
    };
  }

  const webUrl = process.env.WEB_URL ?? "http://localhost:4300";
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, role: roleResult.data },
      emailRedirectTo: `${webUrl}/auth/confirm?next=${encodeURIComponent("/")}`,
    },
  });

  await recordAuthAttempt(supabase, email, "register", !signUpError);

  if (signUpError || !signUpData.user) {
    // Mesma mensagem genérica do NIF: um "já existe" aqui é enumeração de
    // contas por e-mail, que 08 §7.6 manda evitar.
    return { fieldErrors: { email: GENERIC_IDENTITY_ERROR }, step: "account" };
  }

  const profileId = signUpData.user.id;
  const ip = await clientIp();

  // P9-01 — o NIF entra em `profiles` por aqui, e só por aqui.
  const { error: identityError } = await pendingRpc(service, "register_account_identity", {
    p_profile_id: profileId,
    p_tax_id: taxId,
    p_phone: phone,
    p_email: email,
  });
  if (identityError) {
    return { fieldErrors: { taxId: GENERIC_IDENTITY_ERROR }, step: "account" };
  }

  // P9-02 — a aceitação fica registada ANTES do pagamento: é a aceitação que
  // autoriza o contrato, não o contrário.
  const userAgent = (await headers()).get("user-agent");
  const { error: acceptError } = await pendingRpc(service, "record_terms_acceptance", {
    p_document_id: documentId,
    p_context: "registration",
    p_ip: ip,
    p_user_agent: userAgent,
    p_profile_id: profileId,
  });
  if (acceptError) {
    return { error: "Não foi possível registar a aceitação dos Termos. Tente novamente." };
  }

  try {
    const stripe = getStripeClient();
    const customer = await stripe.customers.create({
      email,
      name: fullName,
      phone,
      metadata: { upm_profile_id: profileId },
    });

    await service
      .from("profiles")
      .update({ stripe_customer_id: customer.id })
      .eq("id", profileId)
      .is("stripe_customer_id", null);

    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${webUrl}/criar-conta/verificacao?email=${encodeURIComponent(email)}&pago=1`,
      cancel_url: `${webUrl}/criar-conta/verificacao?email=${encodeURIComponent(email)}&pago=0`,
      tax_id_collection: { enabled: true },
      billing_address_collection: "auto",
      metadata: { upm_profile_id: profileId, upm_plan_slug: planSlug },
      subscription_data: {
        // O webhook copia isto para `subscriptions.terms_document_id` (P9-03):
        // a subscrição guarda a versão dos Termos com que foi contratada.
        metadata: {
          upm_profile_id: profileId,
          upm_plan_slug: planSlug,
          upm_terms_document_id: documentId,
          upm_terms_version: terms.version,
        },
      },
    });

    if (!checkout.url) {
      return { error: "Não foi possível abrir o pagamento. Tente novamente a partir de Entrar." };
    }
    return { checkoutUrl: checkout.url };
  } catch {
    // A conta ficou criada e os Termos aceites; o que falhou foi o pagamento.
    // Dizemos isso, em vez de insinuar que o registo se perdeu.
    return {
      error:
        "A conta foi criada, mas não foi possível abrir o pagamento. Entre na sua conta para concluir a subscrição.",
    };
  }
}

export async function resendVerificationEmail(
  _prev: ResendState,
  formData: FormData,
): Promise<ResendState> {
  const emailResult = emailSchema.safeParse(formData.get("email"));
  if (!emailResult.success) return { error: "E-mail inválido." };
  const email = emailResult.data;

  const supabase = createClient(await cookies());

  const rateLimit = await checkAuthRateLimit(supabase, email, "resend_verification");
  if (!rateLimit.allowed) {
    return {
      error: `Demasiadas tentativas. Tente novamente dentro de ${rateLimit.retryAfterSeconds}s.`,
    };
  }

  const webUrl = process.env.WEB_URL ?? "http://localhost:4300";
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${webUrl}/auth/confirm?next=${encodeURIComponent("/")}`,
    },
  });
  await recordAuthAttempt(supabase, email, "resend_verification", !error);

  if (error) return { error: "Não foi possível reenviar o e-mail. Tente novamente." };
  return { sent: true };
}
