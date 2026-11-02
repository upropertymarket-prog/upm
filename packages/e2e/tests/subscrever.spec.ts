/**
 * Percurso 2 de 12 §11 — subscrever, com o Stripe de teste
 * =========================================================================
 * Uma conta já confirmada e sem plano (quem abandonou o checkout no registo
 * volta por aqui) contrata um plano em `/plano`: aceita os Termos, paga no
 * checkout real do Stripe com o cartão de teste, e o webhook — com a
 * subscrição verdadeira e a assinatura verdadeira (`lib/stripe.ts`) — põe o
 * plano ativo. Separado do registo de propósito: não envia e-mail nenhum, e
 * por isso não depende do SMTP do Supabase Auth (ver o teste do registo).
 */
import { expect, test } from "@playwright/test";

import { APP, temBase, temStripeDeTeste } from "../lib/ambiente";
import { apagarContas, criarConta, service } from "../lib/contas";
import { entrarComoCliente } from "../lib/sessao";
import { concluirPagamentoDeTeste, entregarWebhook, limparClienteStripe } from "../lib/stripe";
import { t } from "../lib/textos";

test.skip(!temBase || !temStripeDeTeste, "Sem Supabase ou sem Stripe de teste");

let clienteStripe: string | null = null;

test.afterAll(async () => {
  if (clienteStripe) await limparClienteStripe(clienteStripe);
  await apagarContas();
});

test("um proprietário sem plano subscreve em /plano, paga no Stripe e fica com o plano ativo", async ({
  page,
}) => {
  test.setTimeout(420_000);
  const dono = await criarConta("owner", "E2E Subscrição");
  const { data: plano } = await service()
    .from("plans")
    .select("id, name")
    .eq("slug", "essential-owner")
    .single();
  expect(plano, "o plano essential-owner tem de existir").not.toBeNull();

  await entrarComoCliente(page, dono);
  await page.goto(`${APP}/plano`);

  // Os Termos primeiro — sem eles a app nem chega a abrir o Stripe.
  // O componente esconde a caixa nativa e desenha outra: clica-se no rótulo,
  // como uma pessoa faz, e confirma-se que ficou marcada.
  const termos = page.getByRole("checkbox", { name: new RegExp(t("plan.contract.acceptPrefix")) });
  await page.getByText(t("plan.contract.acceptPrefix"), { exact: false }).first().click();
  await expect(termos).toBeChecked();
  await page
    .locator(
      `xpath=//*[normalize-space()="${plano!.name}"]/ancestor::*[.//button][1]//button[contains(normalize-space(), "${t("plan.switchPlan")}")]`,
    )
    .first()
    .click();

  // A app tem de criar a sessão e levar lá o cliente. Até 2 nov não levava:
  // a criação falhava sempre (faltava `customer_update`). Se não chegar, diz-se
  // o que a ação respondeu, em vez de um timeout mudo.
  await page.waitForURL(/checkout.stripe.com/, { timeout: 120_000 }).catch(() => {
    throw new Error("Não chegou ao Stripe — o motivo está no registo do servidor, em [checkout].");
  });

  // A sessão que a app criou: o cliente deste perfil, o plano pedido, e os
  // metadados que o webhook vai ler. O pagamento faz-se pela API (ver
  // `concluirPagamentoDeTeste`: a página do Stripe tem hCaptcha).
  const { sessao, subscricao, cliente } = await concluirPagamentoDeTeste(page.url());
  clienteStripe = cliente;
  const { data: perfil } = await service()
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", dono.id)
    .single();
  expect(perfil?.stripe_customer_id).toBe(cliente);
  expect(sessao.mode).toBe("subscription");
  expect(sessao.metadata).toMatchObject({
    upm_profile_id: dono.id,
    upm_plan_slug: "essential-owner",
  });
  expect(subscricao.status).toBe("active");

  // O webhook, com a subscrição verdadeira e a assinatura verdadeira.
  const subs = { data: [subscricao] };
  const resposta = await entregarWebhook("customer.subscription.created", subscricao);
  expect(resposta.status).toBe(200);

  await expect
    .poll(
      async () =>
        (
          await service()
            .from("subscriptions")
            .select("status, plan_id")
            .eq("profile_id", dono.id)
            .maybeSingle()
        ).data,
      { timeout: 30_000 },
    )
    .toMatchObject({ status: "active", plan_id: plano!.id });

  // Um evento com a assinatura errada é recusado — saber o URL não chega.
  const forjado = await fetch(`${APP}/api/stripe/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=forjado" },
    body: JSON.stringify({
      type: "customer.subscription.deleted",
      data: { object: subs.data[0] },
    }),
  });
  expect(forjado.status).toBeGreaterThanOrEqual(400);
  const { data: depois } = await service()
    .from("subscriptions")
    .select("status")
    .eq("profile_id", dono.id)
    .single();
  expect(depois?.status).toBe("active");

  // E no ecrã: o plano contratado é agora o "Plano atual".
  await page.goto(`${APP}/plano`);
  await expect(page.getByRole("button", { name: t("plan.currentPlanButton") })).toBeVisible();
});
