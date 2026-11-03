/**
 * Percurso 5 de 12 §11 — recuperar a palavra-passe
 * =========================================================================
 * Quem perde a palavra-passe não tem mais nenhuma porta: se este caminho
 * partir, a conta fica perdida. Prova-se do pedido ao fim: o ecrã de pedido,
 * o link (pelo mesmo browser, como o e-mail o abriria), a nova palavra-passe,
 * e — o que importa — que a antiga deixa de servir e a nova passa a servir.
 */
import { randomBytes } from "node:crypto";

import { expect, test } from "@playwright/test";

import { APP, WEB, temBase, MOTIVO_SEM_SMTP, temSmtpProprio } from "../lib/ambiente";
import { anon, apagarContas, criarConta, emailEntregavel, PALAVRA_PASSE } from "../lib/contas";
import { linkDeVerificacao, tokenDeRecuperacao } from "../lib/links-de-email";
import { entrarComoCliente } from "../lib/sessao";
import { t } from "../lib/textos";

test.skip(!temBase, "Sem credenciais do projeto Supabase");
test.skip(!temSmtpProprio, MOTIVO_SEM_SMTP);

test.afterAll(async () => {
  await apagarContas();
});

test("pede o link, define uma palavra-passe nova, e a antiga deixa de servir", async ({ page }) => {
  // Um endereço que o Auth aceita para enviar: o pedido de recuperação manda
  // um e-mail a sério, e o `.test` das outras contas seria recusado.
  const conta = await criarConta("buyer", "E2E Esquecida", emailEntregavel("recuperar"));
  // Aleatória: a ação recusa palavras-passe que aparecem em fugas conhecidas.
  const nova = `E2e-${randomBytes(9).toString("base64url")}-Nova`;

  // 1. O pedido, no ecrã. O browser guarda aqui o verificador PKCE.
  await page.goto(`${WEB}/recuperar-palavra-passe`);
  await page.getByLabel(t("auth.recovery.email")).fill(conta.email);
  await page.getByRole("button", { name: t("auth.recovery.submit") }).click();
  await expect(page.getByRole("heading", { name: t("auth.recovery.sentTitle") })).toBeVisible();

  // 2. O link que o e-mail traria, aberto no mesmo browser.
  const token = tokenDeRecuperacao(conta.id);
  const destino = `${WEB}/auth/confirm?next=${encodeURIComponent("/recuperar-palavra-passe/confirmar")}`;
  await page.goto(linkDeVerificacao(token, "recovery", destino));
  await expect(
    page.getByRole("heading", { name: t("auth.recovery.newPasswordTitle") }),
  ).toBeVisible();

  // 3. A nova palavra-passe.
  await page.getByLabel(t("auth.recovery.newPassword")).fill(nova);
  await page.getByRole("button", { name: t("auth.recovery.submitNewPassword") }).click();
  await expect(page).toHaveURL(/\/entrar/);

  // 4. A antiga já não entra; a nova entra.
  const comAntiga = await anon().auth.signInWithPassword({
    email: conta.email,
    password: PALAVRA_PASSE,
  });
  expect(comAntiga.error).not.toBeNull();

  await entrarComoCliente(page, conta, nova);
  await expect(page).toHaveURL(new RegExp(`^${APP}`));
});
