"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createAnonClient } from "@upm/db/server";

/**
 * Submissão de formulários públicos (P2-02 · paga D49)
 * =========================================================================
 * Duas ações, uma função SQL. A validação está nos dois lados e é deliberado:
 * o `zod` aqui dá mensagens úteis a quem escreveu mal o e-mail, e a função
 * `submit_site_lead` recusa o mesmo pedido mesmo que alguém chame o RPC
 * diretamente, sem passar por esta action. 08 §7.3 pede as duas camadas.
 *
 * **O IP vem dos cabeçalhos e nunca do corpo do pedido.** É o que alimenta o
 * rate limit; aceitá-lo do cliente seria deixar o bot escolher o seu próprio
 * contador.
 *
 * O cliente é `anon`: quem preenche o formulário não tem sessão, e a função
 * é `security definer` — não há nada aqui que precise da chave de serviço.
 */

const baseSchema = z.object({
  name: z.string().trim().min(2, "Escreva o seu nome.").max(160),
  email: z.string().trim().toLowerCase().email("Verifique o endereço de e-mail.").max(320),
  // O honeypot: um campo escondido que só um bot preenche.
  website: z.string().max(200).optional(),
});

const preRegistrationSchema = baseSchema.extend({
  profileType: z.enum(["owner", "buyer", "empresa"], {
    errorMap: () => ({ message: "Escolha o perfil que o descreve." }),
  }),
  zone: z.string().trim().max(160).optional(),
  consentMarketing: z.literal("on").optional(),
  // 04 §2.1: o consentimento dos Termos é separado e nunca pré-selecionado.
  consentTerms: z.literal("on", {
    errorMap: () => ({ message: "Tem de aceitar os Termos para continuar." }),
  }),
});

const contactSchema = baseSchema.extend({
  reason: z.enum(["vender", "comprar", "planos", "suporte"]).optional(),
  message: z.string().trim().max(5000).optional(),
});

export type LeadFormState = {
  ok?: boolean;
  alreadyConfirmed?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

async function clientIp(): Promise<string | null> {
  const list = await headers();
  const forwarded = list.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || list.get("x-real-ip") || null;
}

function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

/**
 * O erro é sempre genérico para o visitante. A única exceção é o limite de
 * ritmo, porque aí a pessoa pode fazer algo com a informação — esperar.
 */
function messageFor(hint: string | null | undefined): string {
  if (hint === "rate_limited") {
    return "Recebemos vários pedidos deste dispositivo. Tente daqui a alguns minutos.";
  }
  return "Não foi possível enviar o pedido. Tente novamente.";
}

async function submit(
  form: "preinscricao" | "contacto",
  payload: {
    name: string;
    email: string;
    profileType: "owner" | "buyer" | "empresa";
    honeypot?: string;
    reason?: string;
    message?: string;
    consentMarketing?: boolean;
  },
): Promise<LeadFormState> {
  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc("submit_site_lead", {
    p_form: form,
    p_name: payload.name,
    p_email: payload.email,
    p_profile_type: payload.profileType,
    p_reason: payload.reason,
    p_message: payload.message,
    p_consent_marketing: payload.consentMarketing ?? false,
    p_honeypot: payload.honeypot,
    p_ip: (await clientIp()) ?? undefined,
  });

  if (error) return { error: messageFor(error.hint) };

  const row = data?.[0];
  // Honeypot: a função devolveu sucesso sem gravar nada, e `lead_id` vem
  // nulo. O ecrã mostra o mesmo "obrigado" — um bot não deve aprender que
  // foi apanhado.
  if (!row || row.already_confirmed) {
    return { ok: true, alreadyConfirmed: Boolean(row?.already_confirmed) };
  }

  // TODO (P10-03): enviar o e-mail de confirmação com `row.confirm_token`.
  // O relay existe (Resend, D27) mas o `mail-worker` é da Parte 2 da Fase 10.
  // Até lá o token fica gravado em hash e a confirmação faz-se pelo link que
  // o Suporte consegue reemitir — e a inscrição por confirmar é purgada aos
  // 30 dias, como qualquer outra.
  return { ok: true };
}

export async function submitPreRegistration(
  _previous: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  const parsed = preRegistrationSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    profileType: formData.get("profileType"),
    zone: formData.get("zone") ?? undefined,
    consentMarketing: formData.get("consentMarketing") ?? undefined,
    consentTerms: formData.get("consentTerms") ?? undefined,
    website: formData.get("website") ?? undefined,
  });

  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };

  return submit("preinscricao", {
    name: parsed.data.name,
    email: parsed.data.email,
    profileType: parsed.data.profileType,
    honeypot: parsed.data.website,
    // A zona é a única informação livre da pré-inscrição e entra como
    // mensagem: não vale uma coluna só para ela.
    message: parsed.data.zone ? `Zona de interesse: ${parsed.data.zone}` : undefined,
    consentMarketing: parsed.data.consentMarketing === "on",
  });
}

export async function submitContact(
  _previous: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    reason: formData.get("reason") || undefined,
    message: formData.get("message") ?? undefined,
    website: formData.get("website") ?? undefined,
  });

  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };

  return submit("contacto", {
    name: parsed.data.name,
    email: parsed.data.email,
    // Quem escreve pelo formulário de contacto ainda não disse o que é; o
    // CRM do Admin filtra pelo motivo, que é o dado que importa aqui.
    profileType: "buyer",
    honeypot: parsed.data.website,
    reason: parsed.data.reason,
    message: parsed.data.message,
  });
}
