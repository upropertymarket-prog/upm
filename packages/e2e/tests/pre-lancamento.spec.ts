/**
 * Em pré-lançamento, o site é a página de pré-lançamento (12 §34.5)
 * =========================================================================
 * Decisão do cliente (5 nov 2026): enquanto `launch_mode = pre`, quem escrever
 * outro endereço volta à página de pré-lançamento. Os testes unitários provam
 * a lista e a guarda das Server Actions; este prova o sistema montado — o
 * middleware, o `next-intl` e as páginas — num `www` que corre em `pre`
 * (`WEB_PRE`, a 4403; ver `playwright.config.ts`).
 *
 * Não precisa de contas nem de dados: só pede páginas.
 */
import { expect, test } from "@playwright/test";

import { WEB_PRE } from "../lib/ambiente";

const FECHADAS = [
  "/criar-conta",
  "/criar-conta/verificacao",
  "/entrar",
  "/recuperar-palavra-passe",
  "/propriedades",
  "/propriedades/qualquer-imovel",
  "/um-endereco-que-nao-existe",
];

const ABERTAS = ["/", "/pre-inscricao", "/termos", "/privacidade", "/cookies"];

test("o registo, a entrada e o catálogo voltam à página de pré-lançamento", async ({ request }) => {
  for (const rota of FECHADAS) {
    const resposta = await request.get(`${WEB_PRE}${rota}`, { maxRedirects: 0 });
    expect(resposta.status(), rota).toBe(307);
    expect(new URL(resposta.headers()["location"]!, WEB_PRE).pathname, rota).toBe("/");
    // Temporário e sem cache: depois do lançamento o browser não pode
    // continuar a desviar para a home por memória.
    expect(resposta.headers()["cache-control"], rota).toContain("no-store");
  }
});

test("em inglês volta à página de pré-lançamento em inglês", async ({ request }) => {
  const resposta = await request.get(`${WEB_PRE}/en/sign-up`, { maxRedirects: 0 });
  expect(resposta.status()).toBe(307);
  expect(new URL(resposta.headers()["location"]!, WEB_PRE).pathname).toBe("/en");
});

test("um POST ao registo não é repetido como POST na home", async ({ request }) => {
  const resposta = await request.post(`${WEB_PRE}/criar-conta`, {
    form: { email: "x@exemplo.pt" },
    maxRedirects: 0,
  });
  expect(resposta.status()).toBe(303);
});

test("a página, a pré-inscrição, as legais e o técnico continuam a servir", async ({ request }) => {
  for (const rota of [...ABERTAS, "/api/health", "/robots.txt", "/brand/icon-dark.svg"]) {
    const resposta = await request.get(`${WEB_PRE}${rota}`, { maxRedirects: 0 });
    expect(resposta.status(), rota).toBe(200);
  }
});

test("no browser, /criar-conta acaba na página de pré-lançamento", async ({ page }) => {
  await page.goto(`${WEB_PRE}/criar-conta`);
  await expect(page).toHaveURL(`${WEB_PRE}/`);
});
