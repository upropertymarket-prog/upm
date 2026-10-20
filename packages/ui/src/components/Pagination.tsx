"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { cx } from "../lib/cx";

/**
 * Calcula as páginas a mostrar com elipses, mantendo a primeira, a última e
 * uma janela em volta da atual. Exportada para poder ser testada sozinha.
 */
export function paginationRange(page: number, pageCount: number, sibling = 1): (number | "gap")[] {
  if (pageCount <= 1) return pageCount === 1 ? [1] : [];

  const pages = new Set<number>([1, pageCount]);
  for (let p = page - sibling; p <= page + sibling; p++) {
    if (p >= 1 && p <= pageCount) pages.add(p);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  let previous = 0;
  for (const p of sorted) {
    // Um salto de uma só página mostra-se como número: uma elipse no lugar de
    // um número é mais larga e diz menos.
    if (previous && p - previous === 2) out.push(p - 1);
    else if (previous && p - previous > 2) out.push("gap");
    out.push(p);
    previous = p;
  }
  return out;
}

export type PaginationProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** Texto à esquerda, ex.: "1–20 de 248". Já traduzido por quem usa. */
  summary?: string;
  /**
   * Obrigatório desde 20 out 2026 (D72). Era opcional, com
   * `{ previous: "Anterior", next: "Seguinte", page: "Página" }` por omissão —
   * e um valor por omissão em português dentro de `@upm/ui` é idioma escondido
   * num pacote que não deve ter nenhum. Quem monta o componente é que sabe em
   * que língua o ecrã está; as chaves estão em `pagination`.
   */
  labels: { previous: string; next: string; page: string };
  className?: string;
};

/**
 * Pagination — 08 §3.4
 * =========================================================================
 * 08 §3.4 torna a paginação obrigatória em toda a listagem. Este componente é
 * só o controlo: quem corta os dados é o servidor, com keyset nas listas
 * grandes. Recebe a página atual e o total, e emite a página pedida.
 *
 * `<nav>` com `aria-current="page"` na atual — é assim que um leitor de ecrã
 * sabe onde está sem ter de adivinhar pela cor.
 *
 * O canvas deste componente está em tempo/designs/design-system/navegacao/index.canvas.tsx.
 * Se alterar este componente, mantenha o canvas e a declaração de asset coerentes.
 */
export function Pagination({
  page,
  pageCount,
  onPageChange,
  summary,
  labels,
  className,
}: PaginationProps) {
  if (pageCount <= 1 && !summary) return null;

  const items = paginationRange(page, pageCount);

  return (
    <nav className={cx("upm-pagination", className)} aria-label={labels.page}>
      {summary ? <span className="upm-pagination__info">{summary}</span> : null}
      <button
        type="button"
        className="upm-page"
        disabled={page <= 1}
        aria-label={labels.previous}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft size={16} aria-hidden="true" />
      </button>
      {items.map((item, index) =>
        item === "gap" ? (
          <span key={`gap-${index}`} className="upm-page__gap" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            className="upm-page"
            aria-current={item === page ? "page" : undefined}
            aria-label={`${labels.page} ${item}`}
            onClick={() => onPageChange(item)}
          >
            {item}
          </button>
        ),
      )}
      <button
        type="button"
        className="upm-page"
        disabled={page >= pageCount}
        aria-label={labels.next}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </nav>
  );
}
