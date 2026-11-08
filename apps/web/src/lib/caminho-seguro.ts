/**
 * `next` vem do URL, e quem manda o link escreve-o. Colado ao `origin` sem
 * verificação, `?next=@site-alheio.com` dava `https://www…pt@site-alheio.com`
 * — o browser lê o que está antes do `@` como utilizador e vai para o outro
 * site, com uma sessão acabada de abrir (encontrado a 5 nov 2026). Só se aceita
 * um caminho deste site: começa por `/` e não por `//` nem `/\`.
 */
export function caminhoSeguro(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/";
  }
  return next;
}
