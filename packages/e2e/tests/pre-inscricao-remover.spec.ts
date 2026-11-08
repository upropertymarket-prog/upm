/**
 * Pré-inscrição: inscrever, confirmar e apagar pelo e-mail (8 nov 2026)
 * =========================================================================
 * O percurso inteiro no `www` em pré-lançamento (`WEB_PRE`): o formulário, o
 * e-mail de confirmação na fila (com o link de confirmar e o de remover), a
 * confirmação, e a remoção — que apaga o lead e os e-mails dele, e cujo link
 * não serve uma segunda vez.
 *
 * O endereço é o de teste do Resend (`delivered+…@resend.dev`): a fila pode
 * entregá-lo a meio do teste sem chegar a ninguém.
 */
import { expect, test } from "@playwright/test";

import { WEB_PRE } from "../lib/ambiente";
import { emailEntregavel, service } from "../lib/contas";
import { t } from "../lib/textos";

const email = emailEntregavel("preinscricao");

// Se o teste parar a meio, o lead não fica para trás.
test.afterAll(async () => {
  const { data } = await service().from("site_leads").select("id").eq("email", email);
  const ids = (data ?? []).map((l) => l.id as string);
  if (ids.length) {
    await service().from("site_lead_events").delete().in("lead_id", ids);
    await service().from("site_leads").delete().in("id", ids);
  }
  await service().from("notification_deliveries").delete().eq("recipient", email);
});

async function entrega() {
  const { data } = await service()
    .from("notification_deliveries")
    .select("payload")
    .eq("recipient", email)
    .eq("template", "site_lead_confirmation")
    .neq("status", "cancelled");
  return (data ?? [])[0]?.payload as
    { link: string; optOutLink: string; signoff: string; closing: string } | undefined;
}

test("inscreve-se, confirma, e apaga a pré-inscrição pelo link do e-mail", async ({ page }) => {
  // 1. O formulário.
  await page.goto(`${WEB_PRE}/pre-inscricao`);
  await page.getByLabel(t("site.preRegistration.roleLabel")).selectOption("buyer");
  await page.getByLabel(t("site.preRegistration.name")).fill("E2E Remoção");
  await page.getByLabel(t("site.preRegistration.email")).fill(email);
  await page.locator('input[name="consentTerms"]').check();
  await page.getByRole("button", { name: t("site.preRegistration.submit") }).click();
  await expect(page.getByText(t("site.preRegistration.okTitle"))).toBeVisible();

  // 2. O e-mail na fila: o link de confirmar, o de remover, e a assinatura.
  const payload = await entrega();
  expect(payload).toBeTruthy();
  expect(payload!.link).toContain("/pre-inscricao/confirmar?token=");
  expect(payload!.optOutLink).toMatch(/\/pre-inscricao\/remover\?token=[0-9a-f]{64}$/);
  expect(payload!.signoff).toBe(t("site.preRegistration.confirmEmail.signoff"));
  expect(payload!.closing).toBe(t("site.preRegistration.confirmEmail.closing"));

  // 3. Confirmar — a remoção tem de servir também depois de confirmar.
  await page.goto(payload!.link);
  await page.getByRole("button", { name: t("site.preRegistration.confirmPage.confirm") }).click();
  await expect(
    page.getByRole("heading", { name: t("site.preRegistration.confirmPage.okTitle") }),
  ).toBeVisible();

  // 4. Abrir o link de remover não apaga nada: só o botão (POST).
  await page.goto(payload!.optOutLink);
  await expect(
    page.getByRole("heading", { name: t("site.preRegistration.removePage.title") }),
  ).toBeVisible();
  const antes = await service().from("site_leads").select("id").eq("email", email);
  expect(antes.data).toHaveLength(1);

  await page.getByRole("button", { name: t("site.preRegistration.removePage.remove") }).click();
  await expect(
    page.getByRole("heading", { name: t("site.preRegistration.removePage.okTitle") }),
  ).toBeVisible();

  // 5. O lead e os e-mails dele saíram da base.
  const [leads, deliveries] = await Promise.all([
    service().from("site_leads").select("id").eq("email", email),
    service().from("notification_deliveries").select("id").eq("recipient", email),
  ]);
  expect(leads.data).toEqual([]);
  expect(deliveries.data).toEqual([]);

  // 6. O mesmo link, outra vez: já não serve.
  await page.goto(payload!.optOutLink);
  await page.getByRole("button", { name: t("site.preRegistration.removePage.remove") }).click();
  await expect(
    page.getByRole("heading", { name: t("site.preRegistration.removePage.failTitle") }),
  ).toBeVisible();
});
