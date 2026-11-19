/**
 * Mudar de página muda o ecrã logo (19 nov 2026)
 * ===========================================================================
 * Pedido do cliente: ao carregar no menu, a app ficava parada na página antiga
 * até a nova vir inteira do servidor, e isso lia-se como lentidão. A causa
 * eram dois defeitos juntos: o menu era `<a>` — cada clique recarregava o
 * documento inteiro — e nenhuma rota tinha `loading.tsx`.
 *
 * O que este teste guarda é o contrato, não o tempo (o tempo do `next dev`
 * não diz nada sobre produção):
 *
 *  1. **Não há recarga**: uma marca posta no `window` antes do clique continua
 *     lá depois — o documento é o mesmo.
 *  2. **O menu responde ao clique**: o item de destino fica ativo, e o
 *     conteúdo novo chega.
 *
 * **O esqueleto não se testa aqui, e é de propósito.** Os E2E correm em
 * `next dev`, e em desenvolvimento o `Link` não faz prefetch: sem ele, o
 * router espera pela resposta inteira antes de trocar o ecrã, e o esqueleto
 * nunca chega a pintar. Experimentado a 19 nov 2026 — com a rede estrangulada
 * por CDP, o ecrã antigo ficou mais de um minuto, sem esqueleto. Uma asserção
 * sobre ele aqui passava ou falhava ao acaso.
 *
 * Em produção é o prefetch que o traz antes do clique. Medido no mesmo dia,
 * com `next build` + `next start` e o menu inteiro do Admin: 60–190 ms do
 * clique ao esqueleto, 0,4–1,5 s ao conteúdo. Para repetir, é essa a montagem.
 */
import { expect, test, type Page } from "@playwright/test";

import { INTERNO, temBase } from "../lib/ambiente";
import { apagarContas, criarConta, darPlano, PALAVRA_PASSE } from "../lib/contas";
import { entrarComoCliente } from "../lib/sessao";
import { t } from "../lib/textos";
import { codigo, fatorVerificado } from "../lib/totp";

test.skip(!temBase, "Sem credenciais do projeto Supabase");

test.afterAll(async () => {
  await apagarContas();
});

/** Marca o documento antes do clique: se houver recarga, a marca perde-se. */
async function vigiar(pagina: Page) {
  await pagina.waitForLoadState("load");
  await pagina.evaluate(() => {
    (window as unknown as { __mesmoDocumento: boolean }).__mesmoDocumento = true;
  });
}

async function verificar(pagina: Page) {
  const mesmo = await pagina.evaluate(
    () => (window as unknown as { __mesmoDocumento?: boolean }).__mesmoDocumento === true,
  );
  expect(mesmo, "o clique no menu recarregou o documento").toBe(true);
}

/**
 * Um item do menu lateral, pelo `title` — que é o rótulo. O nome acessível
 * não serve: um item com contador lê-se "Leads do site 3 por ler".
 */
const itemDoMenu = (pagina: Page, nome: string) =>
  pagina.locator(`.upm-sidebar a[title="${nome}"]`);

test("interno: o menu troca de página sem recarregar o documento", async ({ page }) => {
  const admin = await criarConta("admin", "E2E Admin navegação");
  const segredo = await fatorVerificado(admin.email, PALAVRA_PASSE);

  await page.goto(`${INTERNO}/entrar`);
  await page.getByLabel(t("auth.login.email")).fill(admin.email);
  await page.getByLabel(t("auth.login.password"), { exact: true }).fill(PALAVRA_PASSE);
  await page.getByRole("button", { name: t("auth.login.submit") }).click();
  await expect(page.getByRole("heading", { name: t("auth.mfa.challenge.title") })).toBeVisible();
  // O código de `fatorVerificado` já foi gasto: espera pela janela seguinte.
  await new Promise((r) => setTimeout(r, 31_000 - (Date.now() % 30_000)));
  await page.getByLabel(t("auth.mfa.challenge.codeLabel")).fill(codigo(segredo));
  await page.getByRole("button", { name: t("auth.mfa.challenge.submit") }).click();
  await expect(page).toHaveURL(`${INTERNO}/admin/painel`);
  await expect(itemDoMenu(page, t("nav.dashboard"))).toHaveAttribute("aria-current", "page");

  await vigiar(page);
  await itemDoMenu(page, t("nav.siteLeads")).click();
  await expect(page).toHaveURL(`${INTERNO}/admin/leads-site`);
  await expect(itemDoMenu(page, t("nav.siteLeads"))).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 1, name: t("admin.leads.title") })).toBeVisible();
  await verificar(page);
});

test("app: o menu troca de página sem recarregar o documento", async ({ page }) => {
  const comprador = await criarConta("buyer", "E2E Comprador navegação");
  // Sem plano, o middleware manda todas as rotas para `/plano` (P7).
  await darPlano(comprador.id, "premium-buyer");
  await entrarComoCliente(page, comprador);
  await expect(itemDoMenu(page, t("nav.dashboard"))).toBeVisible();

  await vigiar(page);
  await itemDoMenu(page, t("nav.settings")).click();
  await expect(itemDoMenu(page, t("nav.settings"))).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 1, name: t("settings.title") })).toBeVisible();
  await verificar(page);
});
