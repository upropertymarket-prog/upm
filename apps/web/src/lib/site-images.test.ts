import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { SITE_IMAGES } from "./site-content";

/**
 * As fotografias do site existem onde o site e o canvas as procuram
 * =========================================================================
 * O site serve-as de `apps/web/public/`; o canvas corre num Vite próprio, que
 * só serve `tempo/public/` — o mesmo motivo por que a marca já lá estava
 * (`tempo/public/brand`). São duas cópias, e este teste é o que impede que
 * divirjam: uma fotografia trocada só num dos lados dava uma storyboard que
 * já não é a página que vai para produção, ou uma imagem partida no site.
 */
const RAIZ = join(__dirname, "../../../..");

describe("SITE_IMAGES", () => {
  for (const [lugar, imagem] of Object.entries(SITE_IMAGES)) {
    if (!imagem) continue;

    it(`${lugar}: o ficheiro existe no site e no canvas, igual nos dois`, () => {
      const noSite = readFileSync(join(RAIZ, "apps/web/public", imagem.src));
      const noCanvas = readFileSync(join(RAIZ, "tempo/public", imagem.src));
      expect(noCanvas.equals(noSite)).toBe(true);
    });

    it(`${lugar}: é WebP e cabe no orçamento de 250 KB`, () => {
      const ficheiro = readFileSync(join(RAIZ, "apps/web/public", imagem.src));
      // "RIFF....WEBP": a assinatura de um WebP, e não uma extensão a mentir.
      expect(ficheiro.subarray(0, 4).toString("ascii")).toBe("RIFF");
      expect(ficheiro.subarray(8, 12).toString("ascii")).toBe("WEBP");
      expect(ficheiro.length).toBeLessThan(250 * 1024);
    });
  }
});
