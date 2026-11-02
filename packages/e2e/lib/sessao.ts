/**
 * Entrar como um cliente, pela porta da frente
 * =========================================================================
 * Compradores e proprietários entram no site público (`/entrar`) e são
 * levados para o `app`. É o caminho real, com o rate limit, o middleware e o
 * cookie partilhado entre as duas origens — por isso os testes entram por
 * aqui e não injetando uma sessão.
 */
import { expect, type Page } from "@playwright/test";

import { APP, WEB } from "./ambiente";
import { PALAVRA_PASSE, type Conta } from "./contas";
import { t } from "./textos";

export async function entrarComoCliente(pagina: Page, conta: Conta, palavraPasse = PALAVRA_PASSE) {
  await pagina.goto(`${WEB}/entrar`);
  await pagina.getByLabel(t("auth.login.email")).fill(conta.email);
  await pagina.getByLabel(t("auth.login.password"), { exact: true }).fill(palavraPasse);
  await pagina.getByRole("button", { name: t("auth.login.submit") }).click();
  await expect(pagina).toHaveURL(new RegExp(`^${APP}`));
}
