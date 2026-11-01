import { describe, expect, it, vi } from "vitest";

import { coverUrlsFor } from "./property-covers";

/**
 * O que estes testes prendem não é o URL — é a **contagem de ida-e-volta**.
 *
 * A versão anterior desta lógica vivia dentro de um `map` e fazia duas
 * chamadas por imóvel. Funcionava, e é por isso que durou: um N+1 não dá erro,
 * dá lentidão proporcional ao sucesso. A única forma de um teste o apanhar é
 * contar as chamadas — e é o que o primeiro teste faz.
 */
type Chamadas = { select: number; assinar: number };

function clienteFalso(
  media: Array<{ property_id: string; path: string; is_cover: boolean; position: number }>,
  chamadas: Chamadas,
) {
  return {
    from: () => ({
      select: () => {
        chamadas.select += 1;
        return {
          in: (...args: unknown[]) => ({
            data: media.filter((m) => (args[1] as string[]).includes(m.property_id)),
          }),
        };
      },
    }),
    storage: {
      from: () => ({
        createSignedUrls: (caminhos: string[]) => {
          chamadas.assinar += 1;
          return {
            data: caminhos.map((path) => ({ path, signedUrl: `https://cdn/${path}?t=1` })),
          };
        },
      }),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const MEDIA = [
  { property_id: "a", path: "a/1.jpg", is_cover: false, position: 1 },
  { property_id: "a", path: "a/2.jpg", is_cover: true, position: 9 },
  { property_id: "b", path: "b/1.jpg", is_cover: false, position: 2 },
  { property_id: "b", path: "b/2.jpg", is_cover: false, position: 0 },
  { property_id: "c", path: "c/1.jpg", is_cover: false, position: 0 },
];

describe("coverUrlsFor", () => {
  it("vinte imóveis custam DUAS ida-e-volta, não quarenta", () => {
    const chamadas: Chamadas = { select: 0, assinar: 0 };
    const ids = Array.from({ length: 20 }, (_, i) => `p${i}`);
    const media = ids.map((id) => ({
      property_id: id,
      path: `${id}/capa.jpg`,
      is_cover: true,
      position: 0,
    }));

    return coverUrlsFor(clienteFalso(media, chamadas), ids).then((mapa) => {
      expect(chamadas).toEqual({ select: 1, assinar: 1 });
      expect(mapa.size).toBe(20);
    });
  });

  it("`is_cover` ganha à posição", async () => {
    const chamadas: Chamadas = { select: 0, assinar: 0 };
    const mapa = await coverUrlsFor(clienteFalso(MEDIA, chamadas), ["a"]);
    // Em `a`, a capa está na posição 9 e a outra na 1: ganha a marcada.
    expect(mapa.get("a")).toContain("a/2.jpg");
  });

  it("sem `is_cover`, ganha a posição mais baixa", async () => {
    const chamadas: Chamadas = { select: 0, assinar: 0 };
    const mapa = await coverUrlsFor(clienteFalso(MEDIA, chamadas), ["b"]);
    expect(mapa.get("b")).toContain("b/2.jpg");
  });

  it("um imóvel sem fotografias fica com `null`, e não desaparece do mapa", async () => {
    const chamadas: Chamadas = { select: 0, assinar: 0 };
    const mapa = await coverUrlsFor(clienteFalso(MEDIA, chamadas), ["a", "sem-fotos"]);
    expect(mapa.has("sem-fotos")).toBe(true);
    expect(mapa.get("sem-fotos")).toBeNull();
  });

  it("lista vazia não faz pedido nenhum", async () => {
    const chamadas: Chamadas = { select: 0, assinar: 0 };
    const mapa = await coverUrlsFor(clienteFalso(MEDIA, chamadas), []);
    expect(chamadas).toEqual({ select: 0, assinar: 0 });
    expect(mapa.size).toBe(0);
  });

  it("ids repetidos ou nulos não multiplicam o pedido", async () => {
    const chamadas: Chamadas = { select: 0, assinar: 0 };
    const mapa = await coverUrlsFor(clienteFalso(MEDIA, chamadas), [
      "a",
      "a",
      null,
      undefined,
      "a",
    ]);
    expect(chamadas.select).toBe(1);
    expect(mapa.size).toBe(1);
  });

  it("quando o Storage não assina, o cartão fica sem capa em vez de rebentar", async () => {
    const cliente = {
      from: () => ({ select: () => ({ in: () => ({ data: MEDIA }) }) }),
      storage: { from: () => ({ createSignedUrls: () => ({ data: null }) }) },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const mapa = await coverUrlsFor(cliente, ["a"]);
    expect(mapa.get("a")).toBeNull();
  });

  it("não inventa capa quando a consulta falha", async () => {
    const cliente = {
      from: () => ({ select: () => ({ in: () => ({ data: null }) }) }),
      storage: { from: () => ({ createSignedUrls: vi.fn() }) },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const mapa = await coverUrlsFor(cliente, ["a"]);
    expect(mapa.get("a")).toBeNull();
  });
});
