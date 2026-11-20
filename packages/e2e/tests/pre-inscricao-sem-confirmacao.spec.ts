/**
 * Pré-inscrição sem confirmação por e-mail (20 nov 2026)
 * =========================================================================
 * Em pré-lançamento, a pré-inscrição guarda o endereço para avisar no
 * lançamento. Até 20 nov pedia confirmação por e-mail, e quem não clicasse era
 * apagado aos 30 dias — as pessoas que se queria avisar. Agora o formulário
 * grava o lead e não enfileira e-mail nenhum.
 *
 * Os links de confirmar e de remover de e-mails já enviados continuam a
 * servir; não há forma de os gerar daqui, e por isso não se testam aqui.
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

test("inscreve-se e fica guardado, sem e-mail de confirmação", async ({ page }) => {
  await page.goto(`${WEB_PRE}/pre-inscricao`);
  await page.getByLabel(t("site.preRegistration.roleLabel")).selectOption("buyer");
  await page.getByLabel(t("site.preRegistration.name")).fill("E2E Pré-inscrição");
  await page.getByLabel(t("site.preRegistration.email")).fill(email);
  await page.locator('input[name="consentTerms"]').check();
  await page.getByRole("button", { name: t("site.preRegistration.submit") }).click();
  await expect(page.getByText(t("site.preRegistration.okTitle"))).toBeVisible();
  await expect(page.getByText(t("site.preRegistration.okBody"))).toBeVisible();

  const { data: leads } = await service()
    .from("site_leads")
    .select("id, form, confirmed_at")
    .eq("email", email);
  expect(leads).toHaveLength(1);
  expect(leads![0]!.form).toBe("preinscricao");

  const { data: entregas } = await service()
    .from("notification_deliveries")
    .select("id")
    .eq("recipient", email);
  expect(entregas ?? []).toHaveLength(0);
});
