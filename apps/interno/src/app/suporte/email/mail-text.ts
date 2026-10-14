/**
 * As duas funções puras do Composer (P10-05)
 * =========================================================================
 * Vivem fora do componente por uma razão que só apareceu quando lhes quis
 * escrever testes: `Composer.tsx` é `"use client"` e importa o editor
 * partilhado, logo importá-lo num teste arrasta o TipTap e o React inteiros
 * para dentro do Vitest. Uma função que transforma uma string noutra não tem
 * nada que estar presa a isso.
 */

/**
 * A versão em texto do corpo — era o `innerText` do `contentEditable`, que
 * desapareceu quando o corpo passou a ser o `RichText` (14 out 2026).
 *
 * Não é um conversor de HTML para texto a sério, e não precisa de ser: serve a
 * parte `text/plain` da mensagem, que é o que um cliente de correio sem HTML
 * mostra. Faz três coisas, e cada uma tem razão para estar aqui: fecha os
 * blocos em linhas (senão dois parágrafos colam-se numa palavra composta),
 * tira as etiquetas, e devolve as entidades ao que eram — um `&amp;` no texto
 * simples é ruído que o destinatário lê.
 */
export function htmlToText(html: string): string {
  return (
    html
      .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      // O `&amp;` vem **em último**: trocá-lo primeiro transformava `&amp;lt;`
      // em `<`, e quem o escreveu queria mostrar a sequência, não o sinal.
      .replace(/&amp;/g, "&")
      // Três linhas em branco seguidas são ruído de marcação, não parágrafos.
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/** "ana@x.pt, rui@y.pt" → duas moradas. Vírgula ou ponto e vírgula, como nos clientes de correio. */
export function parseAddresses(value: string): string[] {
  return value
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean);
}
