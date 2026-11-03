/**
 * O Mapa — pela área visível, e sem HTML de terceiros (3 nov 2026 · 12 §30)
 * =========================================================================
 * Duas mudanças que nenhum outro percurso cobre:
 *
 *  1. **Pela área visível.** A página trazia "todos" os imóveis de uma vez, e
 *     acima dos 1000 o PostgREST cortava sem aviso. Agora o próprio mapa pede
 *     os da área que mostra (`propertiesInBounds`). Prova-se que o pedido sai,
 *     com as coordenadas do ecrã, e que traz o imóvel que lá está.
 *  2. **O título é texto.** O popup montava HTML com o título, que é escrito
 *     pelo proprietário. Prova-se pela resposta: o título chega como dado, e
 *     a página não executa nada dele (`window.__xss` fica por definir).
 */
import { expect, test } from "@playwright/test";

import { APP, temBase } from "../lib/ambiente";
import { apagarContas, criarConta, darPlano, imovelPublicado, service } from "../lib/contas";
import { entrarComoCliente } from "../lib/sessao";

test.skip(!temBase, "Sem credenciais do projeto Supabase");

test.afterAll(async () => {
  await apagarContas();
});

test("o mapa pede os imóveis da área visível, e o título não corre como HTML", async ({ page }) => {
  const dono = await criarConta("owner", "E2E Mapa");
  await darPlano(dono.id, "premium-owner");
  const titulo = `E2E Mapa ${Date.now()} <img src=x onerror="window.__xss=1">`;
  const id = await imovelPublicado(dono.id, titulo);
  // Évora: dentro da vista inicial (centro de Portugal, zoom 6) e longe dos
  // outros imóveis de teste, que estão em Lisboa — perto deles, o ponto
  // junta-se num cluster, e um cluster não abre popup.
  const { error: erroLocal } = await service()
    .from("properties")
    .update({
      location: "SRID=4326;POINT(-7.9097 38.5714)",
      location_approx: "SRID=4326;POINT(-7.9100 38.5720)",
      approx_radius_m: 400,
    })
    .eq("id", id);
  expect(erroLocal).toBeNull();

  const comprador = await criarConta("buyer", "E2E Mapa Comprador");
  await darPlano(comprador.id, "premium-buyer");
  await entrarComoCliente(page, comprador);

  // O pedido da área visível é uma Server Action (POST à própria página).
  // Reconhece-se pelas coordenadas no corpo (`[[oeste,sul,este,norte]]`): a
  // página faz outros POST à mesma rota. Lê-se o pedido e não a resposta: em
  // `next dev` o StrictMode monta o mapa duas vezes e o primeiro pedido é
  // abandonado — que o imóvel veio prova-se no ecrã, pelo popup, abaixo.
  const pedidoDaArea = page.waitForRequest(
    (r) =>
      r.method() === "POST" &&
      new URL(r.url()).pathname === "/mapa" &&
      (r.postData() ?? "").startsWith("[["),
    { timeout: 120_000 },
  );
  await page.goto(`${APP}/mapa`);
  const pedido = await pedidoDaArea;

  // As coordenadas vieram do ecrã: quatro números, oeste < este, sul < norte.
  const corpo = pedido.postData() ?? "";
  const numeros = (corpo.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  expect(numeros.length).toBeGreaterThanOrEqual(4);
  const [oeste, sul, este, norte] = numeros.slice(-4);
  expect(oeste!).toBeLessThan(este!);
  expect(sul!).toBeLessThan(norte!);
  expect(oeste!).toBeLessThan(-7.91);
  expect(este!).toBeGreaterThan(-7.91);

  // O popup do ponto: o título aparece como texto, com o `<img` à vista, e
  // nenhum elemento é criado a partir dele. O pixel calcula-se pela projeção
  // Web Mercator da vista inicial (centro e zoom de `PropertyMap`), que ainda
  // não se mexeu.
  const mapa = page.locator(".maplibregl-canvas");
  const caixa = (await mapa.boundingBox())!;
  const [x, y] = pixelNaVistaInicial(-7.91, 38.572, caixa.width, caixa.height);
  await page.waitForTimeout(1500); // os pontos pintam-se depois da resposta
  await page.mouse.click(caixa.x + x, caixa.y + y);
  const popup = page.locator(".maplibregl-popup-content");
  await expect(popup).toContainText("<img src=x");
  await expect(popup.locator("img")).toHaveCount(0);
  expect(
    await page.evaluate(() => (window as unknown as { __xss?: number }).__xss),
  ).toBeUndefined();
  await page.keyboard.press("Escape");

  // Mover o mapa volta a pedir, com uma área diferente. Pelo botão de zoom:
  // a roda do rato não chega ao mapa no Chrome sem ecrã.
  const segundoPedido = page.waitForRequest(
    (r) =>
      r.method() === "POST" &&
      new URL(r.url()).pathname === "/mapa" &&
      (r.postData() ?? "").startsWith("[["),
    { timeout: 60_000 },
  );
  await page.locator(".maplibregl-ctrl-zoom-in").click();
  expect((await segundoPedido).postData()).not.toBe(corpo);
});

/** Pixel de (lon, lat) na vista inicial do mapa: centro [-8.5, 39.5], zoom 6, mosaicos de 512. */
function pixelNaVistaInicial(lon: number, lat: number, largura: number, altura: number) {
  const mundo = 512 * 2 ** 6;
  const px = (l: number) => ((l + 180) / 360) * mundo;
  const py = (f: number) => {
    const r = (f * Math.PI) / 180;
    return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * mundo;
  };
  return [largura / 2 + px(lon) - px(-8.5), altura / 2 + py(lat) - py(39.5)] as const;
}
