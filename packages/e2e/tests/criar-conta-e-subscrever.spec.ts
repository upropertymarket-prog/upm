/**
 * Percursos 1 e 2 de 12 §11 — criar conta e subscrever (Stripe de teste)
 * =========================================================================
 * No UPM não se cria conta sem plano (P9-05): o registo **é** a subscrição.
 * Prova-se de ponta a ponta, pela ordem que um cliente vive:
 *
 *  1. o assistente de registo (perfil, conta, plano, Termos);
 *  2. o checkout **real** do Stripe, com o cartão de teste;
 *  3. o webhook — com a subscrição verdadeira do Stripe, assinada com o
 *     segredo verdadeiro (ver `lib/stripe.ts`: só o transporte pela rede do
 *     Stripe fica para o C9);
 *  4. a confirmação do e-mail, pelo link que o e-mail traria;
 *  5. a entrada, com o plano ativo.
 */
import { randomBytes } from "node:crypto";

import { expect, test } from "@playwright/test";

import {
  APP,
  WEB,
  temBase,
  temStripeDeTeste,
  MOTIVO_SEM_SMTP,
  temSmtpProprio,
} from "../lib/ambiente";
import { apagarContas, emailEntregavel, registarParaApagar, service } from "../lib/contas";
import { linkDeVerificacao, tokenDeEmail } from "../lib/links-de-email";
import { entrarComoCliente } from "../lib/sessao";
import {
  concluirPagamentoDeTeste,
  entregarWebhook,
  limparClienteStripe,
  nifValido,
} from "../lib/stripe";
import { t } from "../lib/textos";

test.skip(!temBase || !temStripeDeTeste, "Sem Supabase ou sem Stripe de teste");
test.skip(!temSmtpProprio, MOTIVO_SEM_SMTP);

let clienteStripe: string | null = null;

test.afterAll(async () => {
  if (clienteStripe) await limparClienteStripe(clienteStripe);
  await apagarContas();
});

test("um proprietário cria conta, paga no Stripe e entra com o plano ativo", async ({ page }) => {
  test.setTimeout(420_000);
  const email = emailEntregavel("registo");
  const palavraPasse = `E2e-${randomBytes(9).toString("base64url")}-Reg`;

  const { data: plano } = await service()
    .from("plans")
    .select("id, name")
    .eq("slug", "essential-owner")
    .single();
  expect(plano, "o plano essential-owner tem de existir").not.toBeNull();

  // 1. O assistente. Mostra um passo de cada vez: o "Continuar" é sempre o
  // único visível, e não o n-ésimo da página.
  const seguinte = () =>
    page
      .getByRole("button", { name: t("auth.nextButton") })
      .filter({ visible: true })
      .click();
  await page.goto(`${WEB}/criar-conta`);
  await page.getByRole("button", { name: t("auth.register.profile.owner") }).click();
  await seguinte();

  await page.getByLabel(t("auth.register.account.fullName")).fill("E2E Registo Completo");
  await page.getByLabel(t("auth.register.account.taxId")).fill(nifValido());
  await page.getByLabel(t("auth.register.account.phone")).fill("912345678");
  // `exact`: o consentimento de marketing tem "e-mail" no rótulo.
  await page.getByLabel(t("auth.register.account.email"), { exact: true }).fill(email);
  await page.getByLabel(t("auth.register.account.password"), { exact: true }).fill(palavraPasse);
  await seguinte();

  await page.getByRole("button", { name: new RegExp(plano!.name) }).click();
  await seguinte();

  const termos = page.getByRole("checkbox", {
    name: new RegExp(t("auth.register.contract.acceptPrefix")),
  });
  await page.getByText(t("auth.register.contract.acceptPrefix"), { exact: false }).first().click();
  await expect(termos).toBeChecked();
  await page.getByRole("button", { name: t("auth.register.contract.submit") }).click();

  // 2. O checkout do Stripe, com o cartão de teste. Se não chegar lá, diz-se
  // o que o ecrã respondeu, em vez de um timeout mudo — e sem adivinhar a
  // causa: a 3 nov, a mensagem daqui afirmava "é o SMTP", e era o domínio do
  // e-mail. A mensagem genérica do registo esconde o motivo de propósito
  // (enumeração de contas); o motivo real lê-se no Supabase Auth.
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 120_000 }).catch(async () => {
    const erros = await page
      .locator(".upm-field__error, [role=alert]")
      .allInnerTexts()
      .catch(() => [] as string[]);
    throw new Error(
      `O registo não chegou ao Stripe. O ecrã diz: ${erros.filter(Boolean).join(" | ") || "(nada)"}. ` +
        "Causas já vistas: domínio do e-mail recusado pelo signUp; limite do SMTP por omissão (429).",
    );
  });
  // O pagamento faz-se pela API (a página do Stripe tem hCaptcha — ver
  // `concluirPagamentoDeTeste`); o que é da app é chegar aqui com a sessão certa.
  const pago = await concluirPagamentoDeTeste(page.url());

  // A conta existe; regista-se para apagar no fim, com o cliente do Stripe.
  // Pelo id que a sessão leva, e não à procura numa lista: `listUsers` é
  // paginado, e uma procura numa página só falha quando houver mais contas.
  const { data: criada } = await service().auth.admin.getUserById(
    String(pago.sessao.metadata?.upm_profile_id ?? ""),
  );
  const conta = criada.user;
  expect(conta, "o registo criou o utilizador").toBeDefined();
  expect(conta!.email).toBe(email);
  registarParaApagar(conta!.id);
  const { data: perfil } = await service()
    .from("profiles")
    .select("stripe_customer_id, role")
    .eq("id", conta!.id)
    .single();
  expect(perfil?.role).toBe("owner");
  clienteStripe = perfil!.stripe_customer_id;
  expect(clienteStripe).toMatch(/^cus_/);

  // 3. O webhook, com a subscrição verdadeira e a assinatura verdadeira.
  expect(pago.cliente).toBe(clienteStripe);
  expect(pago.sessao.metadata).toMatchObject({ upm_profile_id: conta!.id });
  const subs = { data: [pago.subscricao] };
  const resposta = await entregarWebhook("customer.subscription.created", pago.subscricao);
  expect(resposta.status).toBe(200);

  await expect
    .poll(
      async () =>
        (
          await service()
            .from("subscriptions")
            .select("status, plan_id")
            .eq("profile_id", conta!.id)
            .maybeSingle()
        ).data,
      { timeout: 30_000 },
    )
    .toMatchObject({ status: "active", plan_id: plano!.id });

  // Um evento com a assinatura errada é recusado — não basta saber o URL.
  const forjado = await fetch(`${APP}/api/stripe/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=forjado" },
    body: JSON.stringify({ type: "customer.subscription.deleted", data: { object: subs.data[0] } }),
  });
  expect(forjado.status).toBeGreaterThanOrEqual(400);

  // 4. A confirmação do e-mail, pelo link que o e-mail traria.
  const token = tokenDeEmail(conta!.id, "confirmation_token");
  await page.goto(linkDeVerificacao(token, "signup", `${WEB}/auth/confirm?next=/`));
  const { data: confirmado } = await service().auth.admin.getUserById(conta!.id);
  expect(confirmado.user?.email_confirmed_at).toBeTruthy();

  // 5. Entra, com o plano ativo.
  await entrarComoCliente(page, { id: conta!.id, email, papel: "owner" }, palavraPasse);
  await page.goto(`${APP}/plano`);
  await expect(page.getByText(plano!.name).first()).toBeVisible();
});
