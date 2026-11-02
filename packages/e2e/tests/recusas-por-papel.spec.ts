/**
 * Recusas por papel — o substituto declarado do portão de Server Actions
 * =========================================================================
 * 12 §5.1.1 decidiu não escrever um portão de regex sobre as Server Actions
 * (acusaria o inocente em doze ficheiros; a autorização vive no Postgres). O
 * que o substitui é isto: **tentar** a ação de outro, pelo sistema todo, e
 * ver a recusa. Um regex não o prova; isto sim.
 *
 * O caso mais forte não é o comprador nas rotas do proprietário — isso é o
 * middleware, por papel. É **um proprietário a mexer no imóvel de outro**: aí
 * o papel está certo e a única coisa que o trava é a posse, verificada na
 * ação e na política. O teste faz o que faria um atacante: abre o seu próprio
 * imóvel, e troca o id no pedido da Server Action pelo da vítima.
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

test("o comprador não entra nas páginas do proprietário", async ({ page }) => {
  const comprador = await criarConta("buyer", "E2E Comprador curioso");
  await darPlano(comprador.id, "premium-buyer");
  await entrarComoCliente(page, comprador);

  for (const rota of ["/propriedades/nova", "/leads", "/agenda"]) {
    await page.goto(`${APP}${rota}`);
    await expect(page, rota).not.toHaveURL(new RegExp(`${rota}(\\?|$)`));
  }
});

test("um proprietário não edita o imóvel de outro, nem pela Server Action", async ({ page }) => {
  const vitima = await criarConta("owner", "E2E Vítima");
  const atacante = await criarConta("owner", "E2E Atacante");
  await darPlano(vitima.id, "premium-owner");
  await darPlano(atacante.id, "premium-owner");
  const alvo = await imovelPublicado(vitima.id, "E2E Imóvel da vítima");
  const proprio = await imovelPublicado(atacante.id, "E2E Imóvel do atacante");

  await entrarComoCliente(page, atacante);

  // 1. Pela porta: a página de edição do imóvel alheio não abre.
  await page.goto(`${APP}/propriedades/${alvo}/editar`);
  await expect(page).not.toHaveURL(new RegExp(`/propriedades/${alvo}/editar`));

  // Controlo: o mesmo gesto, no seu próprio imóvel e sem trocar nada, grava.
  // Sem isto, "a vítima ficou igual" podia querer dizer só que o botão não
  // gravou coisa nenhuma.
  await page.goto(`${APP}/propriedades/${proprio}/editar`);
  const campo = page.getByRole("textbox", { name: t("newProperty.title"), exact: true });
  await expect(campo).toBeVisible();
  await campo.fill("E2E Controlo gravado");
  await page.getByRole("button", { name: t("newProperty.saveDraft") }).click();
  await expect
    .poll(
      async () =>
        (await service().from("properties").select("title").eq("id", proprio).single()).data?.title,
      { timeout: 60_000 },
    )
    .toBe("E2E Controlo gravado");

  // 2. Pela janela: abre o seu, e reescreve o pedido da Server Action com o
  //    id da vítima antes de ele sair do browser.
  let reescritos = 0;
  await page.route(`${APP}/propriedades/${proprio}/editar`, async (rota) => {
    const pedido = rota.request();
    const corpo = pedido.postData();
    if (pedido.method() === "POST" && corpo && corpo.includes(proprio)) {
      reescritos++;
      await rota.continue({ postData: corpo.replaceAll(proprio, alvo) });
    } else {
      await rota.continue();
    }
  });

  await page.goto(`${APP}/propriedades/${proprio}/editar`);
  const titulo = page.getByRole("textbox", { name: t("newProperty.title"), exact: true });
  await expect(titulo).toBeVisible();
  await titulo.fill("E2E PIRATEADO");
  await titulo.blur();
  await page.getByRole("button", { name: t("newProperty.saveDraft") }).click();
  await expect.poll(() => reescritos, { timeout: 60_000 }).toBeGreaterThan(0);

  // A vítima não foi tocada.
  const { data } = await service().from("properties").select("title").eq("id", alvo).single();
  expect(data?.title).toBe("E2E Imóvel da vítima");
});
