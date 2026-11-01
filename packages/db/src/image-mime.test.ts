import { describe, expect, it } from "vitest";

import { sniffImageMime, sniffImageMimeAllowed } from "./image-mime";

/**
 * O tipo decidido pelos bytes (12 §5.4).
 *
 * Até 31 out 2026 as fotografias de imóveis eram validadas por `File.type` —
 * que num `FormData` é escrito pelo browser a partir da extensão do nome, e
 * por quem publica o pedido à mão é escrito à vontade. Qualquer ficheiro
 * entrava em `property-media` desde que se dissesse `image/jpeg`.
 *
 * O teste que justifica o módulo é o do executável: `MZ` no início, nome de
 * `.jpg`, tipo declarado `image/jpeg`. É isso que tem de ser recusado.
 */
const bytes = (...valores: number[]) => new Uint8Array([...valores, ...Array(32).fill(0)]);

const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const GIF = bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61);
const WEBP = new Uint8Array([
  0x52,
  0x49,
  0x46,
  0x46,
  0x00,
  0x00,
  0x00,
  0x00,
  0x57,
  0x45,
  0x42,
  0x50,
  ...Array(24).fill(0),
]);

/** Um executável de Windows. O que ninguém quer num bucket de fotografias. */
const EXE = bytes(0x4d, 0x5a, 0x90, 0x00);
/** Um PDF — imagem não é. */
const PDF = bytes(0x25, 0x50, 0x44, 0x46);
/** HTML com script: o clássico "foto" que afinal é uma página. */
const HTML = new TextEncoder().encode("<html><script>alert(1)</script></html>");

describe("sniffImageMime — o que os bytes dizem", () => {
  it("reconhece os quatro formatos", () => {
    expect(sniffImageMime(PNG)).toEqual({ type: "image/png", extension: "png" });
    expect(sniffImageMime(JPEG)).toEqual({ type: "image/jpeg", extension: "jpg" });
    expect(sniffImageMime(GIF)).toEqual({ type: "image/gif", extension: "gif" });
    expect(sniffImageMime(WEBP)).toEqual({ type: "image/webp", extension: "webp" });
  });

  it("RECUSA um executável — é o caso que motivou tudo isto", () => {
    expect(sniffImageMime(EXE)).toBeNull();
  });

  it("recusa PDF, HTML e lixo", () => {
    for (const amostra of [PDF, HTML, bytes(0x00), new Uint8Array()]) {
      expect(sniffImageMime(amostra)).toBeNull();
    }
  });

  it("um RIFF que não é WebP não passa por WebP", () => {
    // RIFF é também o contentor do WAV e do AVI; só o 9.º byte distingue.
    const wav = new Uint8Array([
      0x52,
      0x49,
      0x46,
      0x46,
      0x00,
      0x00,
      0x00,
      0x00,
      0x57,
      0x41,
      0x56,
      0x45,
      ...Array(24).fill(0),
    ]);
    expect(sniffImageMime(wav)).toBeNull();
  });

  it("não rebenta com um ficheiro mais curto do que a assinatura", () => {
    expect(sniffImageMime(new Uint8Array([0x89, 0x50]))).toBeNull();
    expect(sniffImageMime(new Uint8Array([0x52, 0x49, 0x46, 0x46]))).toBeNull();
  });
});

describe("sniffImageMimeAllowed — cada sítio aceita o seu", () => {
  const IMOVEIS = ["image/jpeg", "image/png", "image/webp"] as const;
  const CAMPANHAS = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

  it("as fotografias de imóveis não aceitam GIF", () => {
    expect(sniffImageMimeAllowed(GIF, IMOVEIS)).toBeNull();
    expect(sniffImageMimeAllowed(JPEG, IMOVEIS)).not.toBeNull();
  });

  it("as campanhas aceitam", () => {
    expect(sniffImageMimeAllowed(GIF, CAMPANHAS)).toEqual({
      type: "image/gif",
      extension: "gif",
    });
  });

  it("e nenhuma das duas aceita um executável", () => {
    expect(sniffImageMimeAllowed(EXE, IMOVEIS)).toBeNull();
    expect(sniffImageMimeAllowed(EXE, CAMPANHAS)).toBeNull();
  });

  it("a resposta é a mesma para 'não é imagem' e 'não é desta lista'", () => {
    // Dizer qual dos dois foi só ajuda quem está a sondar.
    expect(sniffImageMimeAllowed(EXE, IMOVEIS)).toBeNull();
    expect(sniffImageMimeAllowed(GIF, IMOVEIS)).toBeNull();
  });
});
