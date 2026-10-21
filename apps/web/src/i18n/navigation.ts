import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/**
 * Navegação com consciência de idioma — o `Link` que o site público usa
 * =========================================================================
 * **É esta a razão pela qual as páginas desceram para `app/[locale]/` em vez
 * de uma reescrita no middleware.** As duas abordagens serviam o
 * `www.upropertymarket.pt/en`; a diferença está no custo que deixam atrás.
 *
 * Com uma reescrita, cada `<Link href="/propriedades">` deste site teria de
 * passar a saber em que idioma está, e um que se esquecesse mandava um
 * visitante inglês para a página portuguesa — sem erro, sem aviso, e só se
 * descobre a navegar. Era uma regra para alguém lembrar em **cada link novo,
 * para sempre**.
 *
 * Com o segmento, este `Link` põe o prefixo sozinho: `href="/propriedades"`
 * dá `/propriedades` em português e `/en/properties` em inglês, e quem
 * escreve o link não tem de pensar nisso. O custo foi mover ficheiros **uma
 * vez**.
 *
 * Por isso a regra deste site passa a ser: **o `Link` e o `redirect` vêm
 * daqui, não de `next/link` nem de `next/navigation`.** Um `next/link` numa
 * página do site não leva o prefixo e sai do idioma em que o visitante está.
 */
export const { Link, redirect, permanentRedirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
