"use server";

import { createHash, randomBytes } from "node:crypto";
import { clientIpFrom } from "@upm/config/security";
import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { createAnonClient, createServiceClient } from "@upm/db/server";
import type { Locale } from "@upm/config";

import { canonicalUrl } from "@/lib/seo";
import type { LeadFormState } from "@/lib/leadFormState";

export type { LeadFormState };

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
    // `error` e não `errorMap` — ver a nota em `packages/db/src/legal.ts`.
    error: () => "Escolha o perfil que o descreve.",
  }),
  zone: z.string().trim().max(160).optional(),
  consentMarketing: z.literal("on").optional(),
  // 04 §2.1: o consentimento dos Termos é separado e nunca pré-selecionado.
  consentTerms: z.literal("on", {
    error: () => "Tem de aceitar os Termos para continuar.",
  }),
});

const contactSchema = baseSchema.extend({
  reason: z.enum(["vender", "comprar", "planos", "suporte"]).optional(),
  message: z.string().trim().max(5000).optional(),
  // Obrigatório desde 6 nov 2026: ver a nota do `ContactForm`.
  consentTerms: z.literal("on", {
    error: () => "Tem de aceitar os Termos para continuar.",
  }),
});

// O IP vem de `clientIpFrom`, que só confia nos cabeçalhos que a Vercel
// reescreve (12 §34.4) — um sítio só para a regra, em vez de uma cópia por ação.
async function clientIp(): Promise<string | null> {
  return clientIpFrom(await headers());
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

/**
 * O `template` da entrega. Não é um enum na base de dados (a coluna é `text`),
 * mas é a chave por que se cancela a entrega anterior — por isso vive numa
 * constante e não em duas strings iguais.
 */
const CONFIRMATION_TEMPLATE = "site_lead_confirmation";

/**
 * O e-mail de confirmação do double opt-in (P2-02)
 * -------------------------------------------------------------------------
 * Aqui estava um TODO, e com ele uma promessa quebrada: a página dizia
 * "enviámos-lhe um e-mail" e nunca saía nenhum. Pior do que o e-mail que falta
 * é a consequência silenciosa — `20261007150100_site_lead_intake.sql` diz que
 * a inscrição só conta como lead depois de confirmada, e portanto **nenhuma
 * pré-inscrição contava**. O CRM mostrava linhas que não eram contactos.
 *
 * **Enfileira, não envia.** A entrega vai para `notification_deliveries` e é o
 * `mail-worker` que a leva ao Resend — a mesma fila do `notify()`, com o
 * marcar-antes-de-enviar e as cinco tentativas que `outbox.ts` já implementa.
 * Enviar daqui era pedir ao visitante que esperasse por um relay e perder o
 * e-mail quando ele estivesse em baixo.
 *
 * **O texto vem daqui e não do worker.** O worker não sabe em que língua a
 * pessoa estava; esta action sabe. É a mesma regra dos componentes de
 * `@upm/ui`: quem tem o contexto é que passa os rótulos.
 *
 * **Falhar aqui é falhar o pedido.** Devolve `false` e o visitante vê o erro
 * genérico, em vez de uma página a prometer um e-mail que não foi enfileirado.
 * Reenviar o formulário é seguro: a função SQL deduplica por (e-mail,
 * formulário) e devolve um token novo.
 */
async function enqueueConfirmationEmail(lead: {
  recipient: string;
  name: string;
  token: string;
  removalToken: string;
}): Promise<boolean> {
  try {
    const locale = (await getLocale()) as Locale;
    const t = await getTranslations({
      locale,
      namespace: "site.preRegistration.confirmEmail",
    });

    // O caminho é o inglês em `/en` (D72) e o URL é absoluto: um link de
    // e-mail não tem página de onde ser relativo.
    const link = `${canonicalUrl({ pathname: "/pre-inscricao/confirmar" }, locale)}?token=${encodeURIComponent(lead.token)}`;
    const removalLink = `${canonicalUrl({ pathname: "/pre-inscricao/remover" }, locale)}?token=${encodeURIComponent(lead.removalToken)}`;

    const service = createServiceClient();

    // Cada submissão gera um token novo e apaga o hash do anterior: uma
    // entrega ainda em fila levaria um link já morto. Cancela-se, em vez de se
    // agrupar — ver a nota no fim de `20261021110000_lead_confirmation_delivery.sql`.
    await service
      .from("notification_deliveries")
      .update({ status: "cancelled" })
      .eq("recipient", lead.recipient)
      .eq("template", CONFIRMATION_TEMPLATE)
      .eq("status", "queued");

    const { error } = await service.from("notification_deliveries").insert({
      // Sem `profile_id`: quem se pré-inscreve não tem conta. A entrega vale
      // pelo `recipient`, que é o que o `outbox.ts` lê.
      channel: "email",
      recipient: lead.recipient,
      template: CONFIRMATION_TEMPLATE,
      payload: {
        title: t("title"),
        body: t("body", { name: lead.name }),
        link,
        cta: t("cta"),
        footer: t("footer"),
        closing: t("closing"),
        signoff: t("signoff"),
        // A saída, no próprio e-mail (8 nov 2026): quem se inscreveu pode
        // apagar a pré-inscrição sem nos escrever — antes ou depois de a
        // confirmar.
        optOutText: t("optOutText"),
        optOutLabel: t("optOutLabel"),
        optOutLink: removalLink,
        lang: locale,
      },
    });

    if (error) throw new Error(error.message);
    return true;
  } catch (error) {
    // O motivo nunca vai para o visitante — para ele é o erro genérico.
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[pre-inscricao] confirmação não enfileirada: ${message}`);
    return false;
  }
}

/**
 * O token do link "remover a minha pré-inscrição" (8 nov 2026)
 * -------------------------------------------------------------------------
 * 32 bytes em hexadecimal, a mesma forma do de confirmação. Na base fica só o
 * sha256 (`remove_site_lead` compara o hash). Um novo a cada submissão: o
 * e-mail anterior é cancelado na fila, e o seu link deixa de servir.
 */
async function issueRemovalToken(leadId: string): Promise<string | null> {
  const token = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(token).digest("hex");
  const { error } = await createServiceClient()
    .from("site_leads")
    .update({ removal_token_hash: hash })
    .eq("id", leadId);
  if (error) {
    console.error(`[pre-inscricao] token de remoção não gravado: ${error.message}`);
    return null;
  }
  return token;
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

  // Sem token não há nada a enviar: ou a função não gravou (honeypot), ou a
  // inscrição já estava confirmada — os dois casos saíram acima.
  // **Só a pré-inscrição confirma por e-mail.** O formulário de contacto gera
  // token igual (é a mesma função SQL), mas quem faz uma pergunta não espera
  // um passo a mais para a fazer chegar — e o Suporte responde à mensagem, não
  // ao consentimento. O que a pré-inscrição pede confirmação para fazer é
  // outra coisa: guardar um endereço para o avisar mais tarde.
  if (form === "preinscricao" && row.confirm_token) {
    const removalToken = await issueRemovalToken(row.lead_id);
    if (!removalToken) return { error: messageFor(null) };
    const queued = await enqueueConfirmationEmail({
      recipient: payload.email,
      name: payload.name,
      token: row.confirm_token,
      removalToken,
    });
    if (!queued) return { error: messageFor(null) };
  }

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
    consentTerms: formData.get("consentTerms") ?? undefined,
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
