/**
 * Percurso 4 de 12 §11 — o staff entra com 2FA
 * =========================================================================
 * A equipa vê dados de todos os clientes; a sua palavra-passe sozinha não pode
 * chegar. O percurso prova as três portas do `interno`:
 *
 *  1. a primeira entrada obriga a configurar o 2FA antes de qualquer página;
 *  2. as entradas seguintes pedem o código — sem ele, não há painel;
 *  3. o site público recusa contas de equipa (07 §6): não há atalho pelo www.
 */
import { expect, test } from "@playwright/test";

import { INTERNO, WEB, temBase } from "../lib/ambiente";
import { apagarContas, criarConta, PALAVRA_PASSE, service } from "../lib/contas";
import { t } from "../lib/textos";
import { codigo, codigoNovo, fatorVerificado } from "../lib/totp";

test.skip(!temBase, "Sem credenciais do projeto Supabase");

test.afterAll(async () => {
  await apagarContas();
});

test("o staff configura o 2FA na primeira entrada e é pedido o código nas seguintes", async ({
  browser,
}) => {
  const staff = await criarConta("support", "E2E Suporte");

  // 1. Primeira entrada: sem fator, o middleware leva ao ecrã de configuração.
  const primeira = await browser.newContext();
  const pagina = await primeira.newPage();
  await pagina.goto(`${INTERNO}/entrar`);
  await pagina.getByLabel(t("auth.login.email")).fill(staff.email);
  await pagina.getByLabel(t("auth.login.password"), { exact: true }).fill(PALAVRA_PASSE);
  await pagina.getByRole("button", { name: t("auth.login.submit") }).click();

  // O que conta é o ecrã: em `next dev` o Next segue o redirecionamento do
  // middleware dentro da navegação do cliente, e o endereço pode ficar em `/`.
  await expect(pagina.getByRole("heading", { name: t("auth.mfa.enroll.title") })).toBeVisible();

  // Antes de configurar, nenhuma outra página abre: volta sempre aqui. (Uma
  // navegação inteira, essa sim, mostra o endereço do redirecionamento.)
  await pagina.goto(`${INTERNO}/suporte/tickets`);
  await expect(pagina).toHaveURL(/\/configurar-2fa/);

  // A chave aparece em blocos de 4 ("ABCD EFGH …"); os espaços saem aqui.
  const chaveNoEcra = async () =>
    (await pagina.locator("p.font-mono").first().textContent())!.replace(/\s/g, "");
  const segredo = await chaveNoEcra();
  expect(segredo).toMatch(/^[A-Z2-7]{16,}$/);

  // Um código errado não pode trocar o QR (14 nov 2026): a página criava um
  // fator novo a cada render, e o re-render da resposta da action deixava a app
  // de autenticação com um fator que já não existia — nenhum código passava.
  await pagina.getByLabel(t("auth.mfa.enroll.codeLabel")).fill("000000");
  await pagina.getByRole("button", { name: t("auth.mfa.enroll.submit") }).click();
  await expect(pagina.getByRole("alert")).toBeVisible();
  expect(await chaveNoEcra()).toBe(segredo);

  const primeiroCodigo = codigo(segredo);
  await pagina.getByLabel(t("auth.mfa.enroll.codeLabel")).fill(primeiroCodigo);
  await pagina.getByRole("button", { name: t("auth.mfa.enroll.submit") }).click();

  // Sem códigos de recuperação desde 8 nov 2026: confirmado o código, entra-se.
  await expect(pagina.getByRole("heading", { name: t("auth.mfa.enroll.title") })).toHaveCount(0);
  await expect(pagina).not.toHaveURL(/\/(entrar|configurar-2fa)/);

  // O fator ficou mesmo — exatamente um, verificado. Até 2 nov a página de
  // configuração apagava-o na re-renderização que se segue à Server Action.
  const { data: fatores } = await service().auth.admin.mfa.listFactors({ userId: staff.id });
  expect(fatores?.factors.filter((f) => f.status === "verified")).toHaveLength(1);
  await primeira.close();

  // 2. Segunda entrada, noutra sessão: o fator existe, e é pedido o código.
  const segunda = await browser.newContext();
  const outra = await segunda.newPage();
  await outra.goto(`${INTERNO}/entrar`);
  await outra.getByLabel(t("auth.login.email")).fill(staff.email);
  await outra.getByLabel(t("auth.login.password"), { exact: true }).fill(PALAVRA_PASSE);
  await outra.getByRole("button", { name: t("auth.login.submit") }).click();

  await expect(outra.getByRole("heading", { name: t("auth.mfa.challenge.title") })).toBeVisible();
  // Sem o código, o painel não abre.
  await outra.goto(`${INTERNO}/suporte/tickets`);
  await expect(outra).toHaveURL(/\/verificar-2fa/);

  await outra
    .getByLabel(t("auth.mfa.challenge.codeLabel"))
    .fill(await codigoNovo(segredo, primeiroCodigo));
  await outra.getByRole("button", { name: t("auth.mfa.challenge.submit") }).click();
  // Passou: nem o ecrã do código, nem o de configuração, nem o de entrada.
  await expect(outra.getByRole("heading", { name: t("auth.mfa.challenge.title") })).toHaveCount(0);
  await expect(outra.getByRole("heading", { name: t("auth.mfa.enroll.title") })).toHaveCount(0);
  await expect(outra.getByLabel(t("auth.login.password"), { exact: true })).toHaveCount(0);
  await expect(outra).not.toHaveURL(/\/(entrar|verificar-2fa|configurar-2fa)/);
  await segunda.close();
});

test("o site público recusa uma conta de equipa", async ({ page }) => {
  const staff = await criarConta("admin", "E2E Admin");

  await page.goto(`${WEB}/entrar`);
  await page.getByLabel(t("auth.login.email")).fill(staff.email);
  await page.getByLabel(t("auth.login.password"), { exact: true }).fill(PALAVRA_PASSE);
  await page.getByRole("button", { name: t("auth.login.submit") }).click();

  await expect(page.getByText(/interno\.upropertymarket\.pt/)).toBeVisible();
  await expect(page).toHaveURL(/\/entrar/);
});

test("quem só tem a palavra-passe não consegue configurar um 2FA seu por cima do verdadeiro", async ({
  page,
}) => {
  // O dono legítimo configurou o 2FA há semanas.
  const staff = await criarConta("admin", "E2E Admin com 2FA");
  await fatorVerificado(staff.email, PALAVRA_PASSE);

  // Um atacante sabe a palavra-passe. Entra, e é-lhe pedido o código.
  await page.goto(`${INTERNO}/entrar`);
  await page.getByLabel(t("auth.login.email")).fill(staff.email);
  await page.getByLabel(t("auth.login.password"), { exact: true }).fill(PALAVRA_PASSE);
  await page.getByRole("button", { name: t("auth.login.submit") }).click();
  await expect(page.getByRole("heading", { name: t("auth.mfa.challenge.title") })).toBeVisible();

  // Tenta o ecrã de configuração, para pôr lá o autenticador dele.
  await page.goto(`${INTERNO}/configurar-2fa`);
  await expect(page).toHaveURL(/\/verificar-2fa/);
  await expect(page.getByRole("heading", { name: t("auth.mfa.enroll.title") })).toHaveCount(0);
});
