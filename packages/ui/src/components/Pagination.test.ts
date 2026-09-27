import { describe, expect, it } from "vitest";

import { paginationRange } from "./Pagination";

describe("paginationRange", () => {
  it("não mostra nada com uma página ou menos", () => {
    expect(paginationRange(1, 0)).toEqual([]);
    expect(paginationRange(1, 1)).toEqual([1]);
  });

  it("mostra todas as páginas quando são poucas", () => {
    expect(paginationRange(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("mantém primeira, última e a janela em volta da atual", () => {
    expect(paginationRange(10, 20)).toEqual([1, "gap", 9, 10, 11, "gap", 20]);
  });

  it("não abre elipse por um único salto de uma página", () => {
    // Entre 1 e 3 só falta o 2: mostrar "…" no lugar de um número seria pior.
    expect(paginationRange(3, 20)).toEqual([1, 2, 3, 4, "gap", 20]);
  });

  it("encosta-se ao fim sem sair do intervalo", () => {
    expect(paginationRange(20, 20)).toEqual([1, "gap", 19, 20]);
  });
});
