/**
 * Concatenação de classes. Deliberadamente minúscula e sem `clsx`/`cva`: os
 * componentes escrevem `className` estático e o painel de estilo dos canvases
 * do Tempo só consegue editar o que é estaticamente analisável no código.
 */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
