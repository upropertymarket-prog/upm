"use client";

import { useRouter } from "@/i18n/navigation";

/**
 * O router do site público, ou `null` quando não há router (o canvas).
 * =========================================================================
 * Gémeo dos de `apps/app` e `apps/interno`, e **separado por uma razão que não
 * é arrumação**: aqui o `useRouter` vem de `@/i18n/navigation` e não de
 * `next/navigation`. No site público a navegação tem de passar pelo
 * `next-intl` — é o que traduz os caminhos e mantém o `/en` (ver
 * `i18n/pathnames.ts`), e é regra do projeto que o `Link` e o `redirect` daqui
 * venham desse módulo. Um hook partilhado num pacote só podia embrulhar um dos
 * dois routers, e dar o do Next a esta app fazia-a navegar para caminhos
 * portugueses a partir do inglês.
 *
 * O `useRouter` do `next-intl` é um invólucro do do Next, por isso herda o
 * mesmo defeito: sem router montado **atira** (`invariant expected app router
 * to be mounted`) em vez de devolver `null`. No canvas — host Vite, sem router
 * — isso levava consigo a árvore toda do `PublicHeader`, e com ela o canvas
 * `01 - site-publico` inteiro, porque o host monta todas as storyboards.
 *
 * O `try`/`catch` à volta do hook é seguro: a regra dos hooks é sobre ordem de
 * chamada, e o `useContext` que lá dentro lê o contexto corre sempre, com ou
 * sem router. O que o `catch` apanha é o `invariant` que vem depois.
 */
export function useCanvasSafeRouter(): ReturnType<typeof useRouter> | null {
  try {
    return useRouter();
  } catch {
    return null;
  }
}
