/**
 * Percurso 3 de 12 §11 — o comprador pede uma visita, o proprietário aceita
 * =========================================================================
 * É o momento em que a plataforma partilha a morada exata de alguém com um
 * desconhecido. Prova-se de ponta a ponta: o pedido sai do Market, chega à
 * agenda do dono, e só depois de ele aceitar nasce a permissão de morada
 * (`property_address_grants`) — para este comprador e mais nenhum.
 */
import { expect, test } from "@playwright/test";

import { APP, temBase } from "../lib/ambiente";
import { apagarContas, criarConta, darPlano, imovelPublicado, service } from "../lib/contas";
import { entrarComoCliente } from "../lib/sessao";
import { t } from "../lib/textos";

test.skip(!temBase, "Sem credenciais do projeto Supabase");

test.afterAll(async () => {
  await apagarContas();
});

test("o comprador pede visita no Market e o proprietário aceita na agenda", async ({ browser }) => {
  const dono = await criarConta("owner", "E2E Proprietária");
  const comprador = await criarConta("buyer", "E2E Comprador");
  await darPlano(dono.id, "premium-owner");
  await darPlano(comprador.id, "premium-buyer");
  const imovel = await imovelPublicado(dono.id, "E2E T2 com varanda");

  // Antes de tudo: nenhuma permissão de morada para este comprador.
  const antes = await service()
    .from("property_address_grants")
    .select("id")
    .eq("property_id", imovel)
    .eq("buyer_id", comprador.id);
  expect(antes.data).toEqual([]);

  // 1. O comprador pede a visita a partir do detalhe do imóvel.
  const cc = await browser.newContext();
  const paginaComprador = await cc.newPage();
  await entrarComoCliente(paginaComprador, comprador);
  await paginaComprador.goto(`${APP}/market/${imovel}`);
  await paginaComprador.getByRole("button", { name: t("market.contact.requestVisit") }).click();

  const daqui = new Date(Date.now() + 5 * 24 * 3600 * 1000);
  await paginaComprador.getByLabel(t("market.contact.date")).fill(daqui.toISOString().slice(0, 10));
  await paginaComprador.getByLabel(t("market.contact.time")).fill("10:30");
  await paginaComprador.getByRole("button", { name: t("market.contact.send") }).click();
  await expect(paginaComprador.getByText(t("market.contact.visitRequested"))).toBeVisible();

  const { data: pedido } = await service()
    .from("visit_requests")
    .select("id, status")
    .eq("property_id", imovel)
    .eq("buyer_id", comprador.id)
    .single();
  expect(pedido?.status).toBe("pending");

  // Pedir não é ver: ainda não há permissão de morada.
  const aindaSem = await service()
    .from("property_address_grants")
    .select("id")
    .eq("property_id", imovel)
    .eq("buyer_id", comprador.id);
  expect(aindaSem.data).toEqual([]);
  await cc.close();

  // 2. A proprietária vê o pedido na agenda e aceita — partilhando a morada.
  const cd = await browser.newContext();
  const paginaDono = await cd.newPage();
  await entrarComoCliente(paginaDono, dono);
  await paginaDono.goto(`${APP}/agenda`);

  // O número do menu (F4: contado na base, não sobre a lista): um pedido à
  // espera de resposta dela.
  const agendaNoMenu = paginaDono.getByRole("link", {
    name: new RegExp(`^${t("nav.visitSchedule")}`),
  });
  await expect(agendaNoMenu).toHaveAccessibleName(new RegExp(`${t("nav.visitSchedule")}\\s*1\\b`));

  await paginaDono
    .getByRole("button", { name: t("visits.accept") })
    .first()
    .click();
  await expect(paginaDono.getByText(t("visits.acceptRequest"))).toBeVisible();
  await paginaDono.getByRole("button", { name: t("visits.acceptAndShare") }).click();
  await expect(paginaDono.getByText(t("visits.acceptedToast"))).toBeVisible();

  // Aceite, já não pede resposta: o número desaparece do menu.
  await paginaDono.reload();
  await expect(agendaNoMenu).toHaveAccessibleName(new RegExp(`^${t("nav.visitSchedule")}$`));
  await cd.close();

  // 3. Na base: aceite, e a permissão nasceu — só para este comprador.
  const { data: depois } = await service()
    .from("visit_requests")
    .select("status")
    .eq("id", pedido!.id)
    .single();
  expect(depois?.status).toBe("accepted");

  const { data: permissoes } = await service()
    .from("property_address_grants")
    .select("buyer_id, revoked_at")
    .eq("property_id", imovel);
  expect(permissoes).toEqual([{ buyer_id: comprador.id, revoked_at: null }]);
});
