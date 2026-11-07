/**
 * A barra do site nunca parte em duas linhas (7 nov 2026)
 * =========================================================================
 * O corte do menu (☰) estava nos 1024 px e a barra completa precisa de
 * ~1140: entre os dois, as âncoras quebravam em duas linhas. O cliente viu-o
 * ao redimensionar a storyboard; a medição de alinhamento e de rolo que
 * acompanhou a mudança não o apanhava, porque só olhava para cinco larguras.
 *
 * Por isso este teste varre a barra de 20 em 20 px, nas duas línguas (os
 * rótulos em inglês têm outra largura). Visto a falhar com o corte antigo:
 * 1040 a 1120 px.
 *
 * Não precisa de contas nem de dados: só mede a página.
 */
import { expect, test } from "@playwright/test";

import { WEB } from "../lib/ambiente";

for (const caminho of ["/", "/en"]) {
  test(`a barra cabe numa linha de 360 a 1600 px (${caminho})`, async ({ page }) => {
    await page.goto(`${WEB}${caminho}`);
    const falhas: string[] = [];

    for (let largura = 360; largura <= 1600; largura += 20) {
      await page.setViewportSize({ width: largura, height: 900 });
      const estado = await page.evaluate(() => {
        const barra = document.querySelector(".upm-topbar")!;
        const interior = document.querySelector(".upm-topbar__inner")!;
        const ancoras = document.querySelector(".upm-topbar__site-nav")!;
        const visiveis = [...interior.children].filter(
          (filho) => getComputedStyle(filho).display !== "none",
        );
        const centros = visiveis.map((filho) => {
          const caixa = filho.getBoundingClientRect();
          return caixa.top + caixa.height / 2;
        });
        return {
          // Uma linha de âncoras tem ~20 px; duas passam dos 32.
          ancorasEmDuasLinhas:
            getComputedStyle(ancoras).display !== "none" &&
            ancoras.getBoundingClientRect().height > 32,
          transborda:
            interior.scrollWidth > interior.clientWidth + 1 ||
            barra.scrollWidth > barra.clientWidth + 1,
          desalinhada: Math.max(...centros) - Math.min(...centros) > 4,
          roloDaPagina: document.documentElement.scrollWidth > window.innerWidth + 1,
        };
      });
      const problemas = Object.entries(estado)
        .filter(([, mal]) => mal)
        .map(([nome]) => nome);
      if (problemas.length > 0) falhas.push(`${largura} px: ${problemas.join(", ")}`);
    }

    expect(falhas).toEqual([]);
  });
}
