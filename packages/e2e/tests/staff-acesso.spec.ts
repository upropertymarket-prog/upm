/**
 * Acesso da equipa — quem decide é a administração (8 e 20 nov 2026)
 * =========================================================================
 * Decisão do cliente: a app é da empresa. Ninguém da equipa define nem
 * recupera a própria palavra-passe — muda-a um admin, e a de um admin muda-a
 * o outro. Quem perde o telemóvel pede a um admin que lhe reponha a 2FA.
 *
 * Os dois percursos de ponta a ponta, contra a base:
 *
 *  1. ninguém muda a própria palavra-passe — nem pelo Supabase Auth, nem com a
 *     chave de serviço; um admin muda a de alguém do suporte (com o PIN), a
 *     antiga deixa de servir e fica no registo;
 *  2. um admin repõe a 2FA de alguém do suporte, que na entrada seguinte volta
 *     ao ecrã do QR.
 *
 * As recusas que só o servidor vê (não-admin, alvo que não é da equipa, o
 * próprio) estão nos testes unitários de `admin/utilizadores/actions.ts`.
 */
import { expect, test, type Browser } from "@playwright/test";

import { INTERNO, temBase } from "../lib/ambiente";
import { anon, apagarContas, criarConta, PALAVRA_PASSE, service, type Conta } from "../lib/contas";
import { t } from "../lib/textos";
import { codigo, fatorVerificado } from "../lib/totp";

test.skip(!temBase, "Sem credenciais do projeto Supabase");

test.afterAll(async () => {
  await apagarContas();
});

const PIN = "482917";

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

test("só um admin muda a palavra-passe da equipa, e a antiga deixa de servir", async ({
  browser,
}) => {
  const admin = await criarConta("admin", "E2E Admin que muda");
  const segredoAdmin = await fatorVerificado(admin.email, PALAVRA_PASSE);
  // Sem 2FA de propósito: o Auth deixa uma sessão destas mudar a palavra-passe,
  // e o que a recusa tem de ser a base.
  const suporte = await criarConta("support", "E2E Suporte sem acesso próprio");

  // O próprio não a muda: nem pelo Supabase Auth, com a sua sessão…
  const proprio = anon();
  const { error: entrada } = await proprio.auth.signInWithPassword({
    email: suporte.email,
    password: PALAVRA_PASSE,
  });
  expect(entrada).toBeNull();
  const escolhidaPeloProprio = "Minha-propria-2026";
  const { error: tentativa } = await proprio.auth.updateUser({ password: escolhidaPeloProprio });
  expect(tentativa).not.toBeNull();
  // …nem com a chave de serviço, por fora da função da administração.
  const porForaDaFuncao = "Por-fora-da-funcao-2026";
  const { error: porFora } = await service().auth.admin.updateUserById(suporte.id, {
    password: porForaDaFuncao,
  });
  expect(porFora).not.toBeNull();

  // Não há "Esqueci-me": o caminho antigo leva à entrada, que manda pedir a um admin.
  const cv = await browser.newContext();
  const v = await cv.newPage();
  await v.goto(`${INTERNO}/recuperar`);
  await expect(v).toHaveURL(/\/entrar/);
  await expect(v.getByText(t("auth.login.staffForgotPassword"))).toBeVisible();
  await cv.close();

  const { contexto, pagina: a } = await entrarComoAdmin(browser, admin, segredoAdmin);

  // No próprio perfil não há "Acesso": a palavra-passe de um admin muda-a o outro.
  await a.goto(`${INTERNO}/admin/equipa?id=${admin.id}`);
  await expect(a.getByRole("button", { name: t("admin.users.resetPassword") })).toHaveCount(0);

  await a.goto(`${INTERNO}/admin/equipa?id=${suporte.id}`);
  await a.getByRole("button", { name: t("admin.users.resetPassword") }).click();
  const janela = a
    .getByRole("dialog")
    .filter({ has: a.getByText(t("admin.users.resetPasswordBody")) });
  const nova = "Nova-palavra-passe-E2e-2026";
  await janela.getByLabel(t("admin.users.newPassword"), { exact: true }).fill(nova);
  await janela.getByLabel(t("admin.users.confirmPassword"), { exact: true }).fill(nova);
  await janela.getByRole("button", { name: t("admin.users.confirmResetPassword") }).click();
  // Pede o PIN de operação.
  await expect(a.getByText(t("auth.pin.stepUp.title"))).toBeVisible();
  await a.getByLabel(t("auth.pin.stepUp.pinLabel")).fill(PIN);
  await a.getByRole("button", { name: t("auth.pin.stepUp.submit") }).click();
  await expect(a.getByText(t("admin.users.resetPasswordDone"))).toBeVisible({ timeout: 30_000 });
  await contexto.close();

  // A antiga deixa de servir, a sessão que estava aberta com ela caiu, e a nova entra.
  expect((await proprio.auth.getUser()).error).not.toBeNull();
  const { error: comAntiga } = await anon().auth.signInWithPassword({
    email: suporte.email,
    password: PALAVRA_PASSE,
  });
  expect(comAntiga).not.toBeNull();
  const { error: comNova } = await anon().auth.signInWithPassword({
    email: suporte.email,
    password: nova,
  });
  expect(comNova).toBeNull();

  // Ficou no registo, com quem o fez — e sem a palavra-passe.
  const { data: rasto } = await service()
    .from("audit_log")
    .select("actor_id, diff")
    .eq("action", "staff.password_set_by_admin")
    .eq("entity_id", suporte.id);
  expect(rasto?.[0]?.actor_id).toBe(admin.id);
  expect(JSON.stringify(rasto)).not.toContain(nova);
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
  await a.goto(`${INTERNO}/admin/equipa?id=${admin.id}`);
  await expect(a.getByRole("button", { name: t("admin.users.resetTwoFactor") })).toHaveCount(0);

  // No de alguém do suporte, há.
  await a.goto(`${INTERNO}/admin/equipa?id=${suporte.id}`);
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
