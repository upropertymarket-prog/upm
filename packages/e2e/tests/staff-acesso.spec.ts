/**
 * Recuperação de acesso da equipa (8 nov 2026)
 * =========================================================================
 * Decisão do cliente: sem códigos de recuperação. Quem perde a palavra-passe
 * recebe um link (os admins pedem-no eles próprios, o resto da equipa pede a
 * um admin); quem perde o telemóvel pede a um admin que lhe reponha a 2FA.
 *
 * Os dois percursos de ponta a ponta, contra a base:
 *
 *  1. o "Esqueci-me" responde o mesmo a qualquer e-mail, mas só envia a um
 *     admin; o link leva a definir a palavra-passe, e a entrada seguinte
 *     continua a pedir o código da app;
 *  2. um admin repõe a 2FA de alguém do suporte, que na entrada seguinte volta
 *     ao ecrã do QR.
 *
 * As recusas que só o servidor vê (não-admin, alvo que não é da equipa, o
 * próprio) estão nos testes unitários de `admin/utilizadores/actions.ts`.
 */
import { expect, test, type Browser } from "@playwright/test";

import { INTERNO, temBase } from "../lib/ambiente";
import { apagarContas, criarConta, PALAVRA_PASSE, service, type Conta } from "../lib/contas";
import { t } from "../lib/textos";
import { codigo, fatorVerificado } from "../lib/totp";

test.skip(!temBase, "Sem credenciais do projeto Supabase");

test.afterAll(async () => {
  await apagarContas();
});

const PIN = "482917";

async function entregasDeRecuperacao(email: string) {
  const { data } = await service()
    .from("notification_deliveries")
    .select("id, payload, status")
    .eq("recipient", email)
    .eq("template", "staff_password_recovery");
  return data ?? [];
}

/** Entra no interno como admin (palavra-passe + 2FA) e define o PIN de operação. */
async function entrarComoAdmin(browser: Browser, admin: Conta, segredo: string) {
  const contexto = await browser.newContext();
  const a = await contexto.newPage();
  await a.goto(`${INTERNO}/entrar`);
  await a.getByLabel(t("auth.login.email")).fill(admin.email);
  await a.getByLabel(t("auth.login.password"), { exact: true }).fill(PALAVRA_PASSE);
  await a.getByRole("button", { name: t("auth.login.submit") }).click();
  await expect(a.getByRole("heading", { name: t("auth.mfa.challenge.title") })).toBeVisible();
  // Uma janela nova: o código de `fatorVerificado` já foi usado nesta.
  await new Promise((r) => setTimeout(r, 31_000 - (Date.now() % 30_000)));
  await a.getByLabel(t("auth.mfa.challenge.codeLabel")).fill(codigo(segredo));
  await a.getByRole("button", { name: t("auth.mfa.challenge.submit") }).click();
  await expect(a.getByRole("heading", { name: t("auth.mfa.challenge.title") })).toHaveCount(0);

  await a.goto(`${INTERNO}/definicoes/seguranca`);
  await a.getByLabel(t("auth.pin.setup.pinLabel")).fill(PIN);
  await a.getByLabel(t("auth.pin.setup.confirmLabel")).fill(PIN);
  await a.getByRole("button", { name: t("auth.pin.setup.submit") }).click();
  await expect
    .poll(
      async () =>
        Boolean(
          (
            await service()
              .from("staff_auth")
              .select("pin_hash")
              .eq("profile_id", admin.id)
              .single()
          ).data?.pin_hash,
        ),
      { timeout: 30_000 },
    )
    .toBe(true);
  return { contexto, pagina: a };
}

test("o Esqueci-me só envia a admins, e o link leva à palavra-passe nova sem saltar a 2FA", async ({
  browser,
}) => {
  const admin = await criarConta("admin", "E2E Admin esquecido");
  await fatorVerificado(admin.email, PALAVRA_PASSE);
  const suporte = await criarConta("support", "E2E Suporte esquecido");

  const pedir = async (email: string) => {
    const contexto = await browser.newContext();
    const p = await contexto.newPage();
    await p.goto(`${INTERNO}/recuperar`);
    await p.getByLabel(t("auth.staffRecovery.email")).fill(email);
    await p.getByRole("button", { name: t("auth.staffRecovery.submit") }).click();
    // A mesma resposta, seja quem for.
    await expect(p.getByRole("heading", { name: t("auth.staffRecovery.sentTitle") })).toBeVisible();
    await contexto.close();
  };

  // Alguém do suporte: a resposta é a mesma, mas não sai nada.
  await pedir(suporte.email);
  expect(await entregasDeRecuperacao(suporte.email)).toHaveLength(0);

  // Um admin: sai o link.
  await pedir(admin.email);
  const [entrega] = await entregasDeRecuperacao(admin.email);
  expect(entrega).toBeTruthy();
  const link = (entrega!.payload as { link: string }).link;
  expect(link).toContain(`${INTERNO}/auth/confirmar?token_hash=`);
  // A fila entrega-a por e-mail; aqui não interessa que saia, interessa o link.
  await service()
    .from("notification_deliveries")
    .update({ status: "cancelled" })
    .eq("id", entrega!.id);

  // O link leva a definir a palavra-passe nova.
  const contexto = await browser.newContext();
  const p = await contexto.newPage();
  await p.goto(link);
  await expect(p.getByRole("heading", { name: t("auth.recovery.newPasswordTitle") })).toBeVisible();
  const nova = "Nova-palavra-passe-E2e-2026";
  await p.getByLabel(t("auth.recovery.newPassword")).fill(nova);
  await p.getByRole("button", { name: t("auth.recovery.submitNewPassword") }).click();
  await expect(p.getByText(t("auth.login.passwordSet"))).toBeVisible();

  // Com a palavra-passe nova, a entrada continua a pedir o código da app.
  await p.getByLabel(t("auth.login.email")).fill(admin.email);
  await p.getByLabel(t("auth.login.password"), { exact: true }).fill(nova);
  await p.getByRole("button", { name: t("auth.login.submit") }).click();
  await expect(p.getByRole("heading", { name: t("auth.mfa.challenge.title") })).toBeVisible();
  await p.goto(`${INTERNO}/admin/painel`);
  await expect(p).toHaveURL(/\/verificar-2fa/);

  // Quem só tem a palavra-passe (esta sessão, `aal1`, sem link) não a troca
  // por `/nova-palavra-passe`: seria a volta à 2FA.
  await p.goto(`${INTERNO}/nova-palavra-passe`);
  await p.getByLabel(t("auth.recovery.newPassword")).fill("Outra-palavra-passe-E2e-2026");
  await p.getByRole("button", { name: t("auth.recovery.submitNewPassword") }).click();
  await expect(p).toHaveURL(/\/entrar\?erro=link_invalido/);

  // E o link não serve duas vezes.
  await p.goto(link);
  await expect(p).toHaveURL(/\/entrar\?erro=link_invalido/);
  await contexto.close();
});

test("um admin repõe a 2FA de quem perdeu o telemóvel, que volta a ler o QR", async ({
  browser,
}) => {
  const admin = await criarConta("admin", "E2E Admin que repõe");
  const segredoAdmin = await fatorVerificado(admin.email, PALAVRA_PASSE);
  const suporte = await criarConta("support", "E2E Suporte sem telemóvel");
  await fatorVerificado(suporte.email, PALAVRA_PASSE);

  const { contexto, pagina: a } = await entrarComoAdmin(browser, admin, segredoAdmin);

  // No próprio perfil não há "Acesso": a 2FA de um admin repõe-na o outro.
  await a.goto(`${INTERNO}/admin/utilizadores?id=${admin.id}`);
  await expect(a.getByRole("button", { name: t("admin.users.resetTwoFactor") })).toHaveCount(0);

  // No de alguém do suporte, há.
  await a.goto(`${INTERNO}/admin/utilizadores?id=${suporte.id}`);
  await a.getByRole("button", { name: t("admin.users.resetTwoFactor") }).click();
  await a
    .getByRole("dialog")
    .filter({ has: a.getByText(t("admin.users.resetTwoFactorBody")) })
    .getByRole("button", { name: t("admin.users.confirmResetTwoFactor") })
    .click();
  // Pede o PIN de operação.
  await expect(a.getByText(t("auth.pin.stepUp.title"))).toBeVisible();
  await a.getByLabel(t("auth.pin.stepUp.pinLabel")).fill(PIN);
  await a.getByRole("button", { name: t("auth.pin.stepUp.submit") }).click();
  await expect(a.getByText(t("admin.users.resetTwoFactorDone"))).toBeVisible({ timeout: 30_000 });
  await contexto.close();

  const { data: fatores } = await service().auth.admin.mfa.listFactors({ userId: suporte.id });
  expect(fatores?.factors).toHaveLength(0);

  // Ficou no registo, com quem o fez.
  const { data: rasto } = await service()
    .from("audit_log")
    .select("actor_id")
    .eq("action", "staff.mfa_reset")
    .eq("entity_id", suporte.id);
  expect(rasto?.[0]?.actor_id).toBe(admin.id);

  // Na entrada seguinte, a pessoa do suporte volta ao QR.
  const cs = await browser.newContext();
  const s = await cs.newPage();
  await s.goto(`${INTERNO}/entrar`);
  await s.getByLabel(t("auth.login.email")).fill(suporte.email);
  await s.getByLabel(t("auth.login.password"), { exact: true }).fill(PALAVRA_PASSE);
  await s.getByRole("button", { name: t("auth.login.submit") }).click();
  await expect(s.getByRole("heading", { name: t("auth.mfa.enroll.title") })).toBeVisible();
  await cs.close();
});
