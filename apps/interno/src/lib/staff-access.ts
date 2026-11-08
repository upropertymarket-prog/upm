// Só se importa a partir de Server Actions e rotas (`"use server"`): usa a
// chave de serviço, e nunca pode entrar num componente de cliente.
import { getTranslations } from "next-intl/server";
import { createServiceClient } from "@upm/db/server";

/**
 * Recuperação de acesso da equipa (8 nov 2026)
 * =========================================================================
 * Decisão do cliente, depois de pesar os códigos de recuperação:
 *
 *  - **Palavra-passe perdida.** Um admin usa "Esqueci-me da palavra-passe" no
 *    ecrã de entrada. O resto da equipa pede a um admin, que lhe envia o link
 *    em Admin › Utilizadores. Em ambos os casos o link vai para o e-mail do
 *    próprio: o admin nunca fica a saber a palavra-passe de ninguém.
 *  - **Telemóvel perdido** (a app da 2FA). Um admin repõe a 2FA dessa pessoa,
 *    que volta a ler um QR na entrada seguinte. Os 10 códigos de recuperação
 *    saíram: com dois admins, cada um repõe o do outro, e o último recurso é o
 *    painel do Supabase (Authentication › Users › fatores).
 *
 * **Repor a palavra-passe não abre a porta.** Depois de a mudar, a entrada
 * continua a pedir o código da app. Quem tomar conta do e-mail de alguém da
 * equipa consegue mudar-lhe a palavra-passe e fica parado no ecrã do código.
 *
 * **O link não passa pelo e-mail do Supabase Auth.** Gera-se com a API de
 * administração (\`generateLink\`, que não envia nada) e vai pela mesma fila
 * dos outros e-mails (\`notification_deliveries\` › Edge Function \`outbox\` ›
 * Resend). Assim não depende do SMTP do Auth (F1), que só se configura no
 * lançamento oficial.
 */

export const STAFF_ROLES = ["admin", "support", "marketing"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

const TEMPLATE = "staff_password_recovery";

function internoUrl(): string {
  return (process.env.INTERNO_URL ?? "http://localhost:4302").replace(/\/+$/, "");
}

/** O perfil de equipa de uma conta, ou \`null\` se não for de equipa. */
export async function staffProfile(
  userId: string,
): Promise<{ id: string; role: StaffRole; status: string; email: string } | null> {
  const service = createServiceClient();
  const [{ data: profile }, { data: auth }] = await Promise.all([
    service.from("profiles").select("id, role, status").eq("id", userId).maybeSingle(),
    service.auth.admin.getUserById(userId),
  ]);
  const email = auth.user?.email;
  if (!profile || !email) return null;
  if (!(STAFF_ROLES as readonly string[]).includes(profile.role)) return null;
  return { id: profile.id, role: profile.role as StaffRole, status: profile.status, email };
}

/**
 * Gera o link de recuperação de uma conta e põe-no na fila de e-mails.
 *
 * Para o "Esqueci-me" do ecrã de entrada, que só serve admins: devolve
 * \`false\` sem enviar nada quando o e-mail não é de um admin ativo, e quem
 * chamou responde o mesmo nos dois casos — quem experimente e-mails ao acaso
 * não fica a saber quem é admin.
 */
export async function sendRecoveryLink(
  email: string,
  options: { onlyIfRole?: readonly StaffRole[] } = {},
): Promise<boolean> {
  const service = createServiceClient();
  const { data, error } = await service.auth.admin.generateLink({ type: "recovery", email });
  if (error || !data.user || !data.properties?.hashed_token) return false;

  const profile = await staffProfile(data.user.id);
  if (!profile || profile.status !== "active") return false;
  if (options.onlyIfRole && !options.onlyIfRole.includes(profile.role)) return false;

  const link = `${internoUrl()}/auth/confirmar?token_hash=${encodeURIComponent(
    data.properties.hashed_token,
  )}&type=recovery`;

  // Um pedido novo invalida o anterior (o Supabase guarda um token por conta):
  // uma entrega ainda em fila levaria um link morto, por isso cancela-se.
  await service
    .from("notification_deliveries")
    .update({ status: "cancelled" })
    .eq("recipient", profile.email)
    .eq("template", TEMPLATE)
    .eq("status", "queued");

  // O interno é em português: o e-mail também, pelo dicionário como o resto.
  const t = await getTranslations({ locale: "pt", namespace: "auth.staffRecovery.emailMessage" });
  const { error: insertError } = await service.from("notification_deliveries").insert({
    channel: "email",
    profile_id: profile.id,
    recipient: profile.email,
    template: TEMPLATE,
    payload: {
      title: t("title"),
      body: t("body"),
      link,
      cta: t("cta"),
      footer: t("footer"),
      lang: "pt",
    },
  });
  return !insertError;
}

/** Remove a 2FA de uma conta: na entrada seguinte, a pessoa lê um QR novo. */
export async function resetStaffMfa(userId: string): Promise<boolean> {
  const service = createServiceClient();
  const { data, error } = await service.auth.admin.mfa.listFactors({ userId });
  if (error) return false;
  for (const factor of data.factors) {
    const { error: deleteError } = await service.auth.admin.mfa.deleteFactor({
      id: factor.id,
      userId,
    });
    if (deleteError) return false;
  }
  return true;
}

/**
 * Grava a palavra-passe nova a partir da sessão do link de recuperação.
 * ---------------------------------------------------------------------------
 * **Pela API de administração, e não pelo `updateUser` da sessão.** O
 * Supabase recusa mudar a palavra-passe a uma conta com 2FA a partir de uma
 * sessão `aal1` — e a do link é `aal1`. Visto no E2E a 8 nov 2026.
 *
 * **Só se a sessão nasceu de um link do e-mail, há pouco.** Sem isto, quem
 * soubesse a palavra-passe de alguém da equipa entrava (`aal1`), ia a
 * `/nova-palavra-passe` e trocava-a sem nunca passar pela 2FA.
 *
 * O Supabase marca a sessão do `verifyOtp({ type: "recovery" })` com
 * `amr: [{ method: "otp" }]`, e não `recovery` (medido a 8 nov 2026). `otp`
 * é também o método de um link mágico — que pede, como o de recuperação, a
 * caixa de correio da pessoa: a mesma prova. Uma sessão de palavra-passe
 * (`password`) nunca passa. E só nos primeiros `RECOVERY_WINDOW_SECONDS`: uma
 * sessão do link esquecida aberta não fica a servir para isto.
 */
export const RECOVERY_WINDOW_SECONDS = 15 * 60;
const EMAIL_LINK_METHODS = ["otp", "recovery"];

export async function setPasswordFromRecoverySession(
  claims:
    | { sub?: string; amr?: Array<string | { method?: string; timestamp?: number }> }
    | null
    | undefined,
  password: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<"ok" | "not_recovery" | "failed"> {
  // O `amr` vem como lista de métodos ou de entradas `{ method, timestamp }`,
  // consoante a versão do Auth. Só a forma com data diz *quando*: a outra não
  // chega para provar que o link é recente.
  const doLink = (claims?.amr ?? []).some(
    (entry) =>
      typeof entry === "object" &&
      EMAIL_LINK_METHODS.includes(entry.method ?? "") &&
      typeof entry.timestamp === "number" &&
      nowSeconds - entry.timestamp <= RECOVERY_WINDOW_SECONDS,
  );
  if (!claims?.sub || !doLink) return "not_recovery";
  const profile = await staffProfile(claims.sub);
  if (!profile) return "not_recovery";
  const service = createServiceClient();
  const { error } = await service.auth.admin.updateUserById(claims.sub, { password });
  return error ? "failed" : "ok";
}
