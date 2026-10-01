"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { createClient } from "@upm/db/server";
import {
  checkAuthRateLimit,
  emailSchema,
  fullNameSchema,
  isPasswordPwned,
  passwordSchema,
  recordAuthAttempt,
  roleAtRegistrationSchema,
} from "@upm/db/auth";

import type { RegisterState } from "./RegisterWizard";
import type { ResendState } from "./verificacao/ResendVerificationForm";
import type { SelectPlanState } from "./plano/PlanForm";

export type { RegisterState, ResendState, SelectPlanState };

/**
 * Registo por passos (P3-01) — 03 F2: Perfil → Conta → Verificação → Plano.
 * Perfil e Conta vivem no mesmo formulário do lado do cliente (RegisterWizard,
 * com "voltar" local); só ao submeter a Conta é que existe uma chamada ao
 * servidor. Verificação e Plano são páginas próprias, porque só existem depois
 * de o Supabase confirmar o e-mail (`enable_confirmations = true` — sem
 * sessão antes disso, 03 F2 não pode continuar).
 */

export async function registerAccount(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const fullNameResult = fullNameSchema.safeParse(formData.get("fullName"));
  const emailResult = emailSchema.safeParse(formData.get("email"));
  const passwordResult = passwordSchema.safeParse(formData.get("password"));
  const roleResult = roleAtRegistrationSchema.safeParse(formData.get("role"));

  if (!roleResult.success) return { error: "Escolha um perfil." };

  const fieldErrors: RegisterState["fieldErrors"] = {};
  if (!fullNameResult.success) fieldErrors.fullName = "Indique o seu nome.";
  if (!emailResult.success) fieldErrors.email = "E-mail inválido.";
  if (!passwordResult.success) fieldErrors.password = "Mínimo 10 caracteres.";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const email = emailResult.data!;
  const password = passwordResult.data!;
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
    };
  }

  const webUrl = process.env.WEB_URL ?? "http://localhost:4300";
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullNameResult.data, role: roleResult.data },
      emailRedirectTo: `${webUrl}/auth/confirm?next=${encodeURIComponent("/criar-conta/plano")}`,
    },
  });

  await recordAuthAttempt(supabase, email, "register", !error);

  if (error) {
    if (error.code === "user_already_exists") {
      return { fieldErrors: { email: "Já existe uma conta com este e-mail." } };
    }
    return { error: "Não foi possível criar a conta. Tente novamente." };
  }

  redirect(`/criar-conta/verificacao?email=${encodeURIComponent(email)}`);
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
      emailRedirectTo: `${webUrl}/auth/confirm?next=${encodeURIComponent("/criar-conta/plano")}`,
    },
  });
  await recordAuthAttempt(supabase, email, "resend_verification", !error);

  if (error) return { error: "Não foi possível reenviar o e-mail. Tente novamente." };
  return { sent: true };
}

export async function selectPlan(
  _prev: SelectPlanState,
  formData: FormData,
): Promise<SelectPlanState> {
  const planId = formData.get("planId");
  if (typeof planId !== "string" || planId.length === 0) {
    return { error: "Escolha um plano." };
  }

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const appUrl = process.env.APP_URL ?? "http://localhost:4301";

  const { data: plan } = await supabase
    .from("plans")
    .select("slug, price_month_cents, price_year_cents")
    .eq("id", planId)
    .eq("visible", true)
    .maybeSingle();

  if (!plan) return { error: "Escolha um plano." };

  // 03 F2: "Plano (Free por omissão) → se pago: Stripe Checkout". Um plano
  // pago não se grava aqui — a subscrição nasce do webhook, depois do
  // pagamento (P7-03). O ecrã `/plano` da app é que abre o Checkout.
  if (plan.price_month_cents > 0 || plan.price_year_cents > 0) {
    redirect(`${appUrl}/plano?plano=${encodeURIComponent(plan.slug)}` as Route);
  }

  // Fase 7: `profiles.plan_id` deixou de ser escrita diretamente — a sessão já
  // não tem privilégio nessa coluna (migração `20261001120100`), senão
  // qualquer um se dava a si próprio o plano de topo. A função só aceita
  // planos gratuitos.
  const { error } = await supabase.rpc("set_registration_plan", { p_plan_id: planId });
  if (error) return { error: "Não foi possível guardar o plano. Tente novamente." };

  // `redirect` com `typedRoutes` só aceita rotas internas conhecidas desta
  // app — um URL absoluto para `app.*` é, de propósito, outra coisa.
  redirect(`${appUrl}/painel` as Route);
}
