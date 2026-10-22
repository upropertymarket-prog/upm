"use client";

import { useRouter } from "next/navigation";

/**
 * O router do Next, ou `null` quando não há router — que é o caso do canvas.
 * =========================================================================
 * Gémeo de `apps/interno/src/lib/useCanvasSafeRouter.ts`, e **separado de
 * propósito**: o que cada app embrulha não é a mesma função. Esta e a do
 * `interno` embrulham o `useRouter` do `next/navigation`; a do `web` embrulha o
 * do `@/i18n/navigation`, porque no site público a navegação tem de ser a do
 * `next-intl` para o idioma viajar no caminho. Um hook partilhado em `@upm/ui`
 * só podia embrulhar um dos dois — e escolher um era dar a outra app o router
 * errado. É a mesma razão que mantém `admin-shell`, `support-shell` e
 * `marketing-shell` separados em vez de um ficheiro com um `if`.
 *
 * ## O problema
 *
 * `useRouter()` não devolve `null` quando não há router montado: **atira**. A
 * implementação é um `useContext` seguido de um `invariant`, e a mensagem é
 * `Error: invariant expected app router to be mounted`.
 *
 * Isto não se via enquanto o sidecar do canvas foi um host **Next**: havia
 * router. Quando passou a **Vite** deixou de haver, e como o host monta
 * **todas** as storyboards de um canvas (não só a que se está a ver), um
 * componente que atira leva o canvas inteiro com ele.
 *
 * ## Porque é um `try`/`catch` à volta de um hook, e porque é seguro
 *
 * A regra dos hooks é sobre **ordem de chamada**, não sobre `try`. O
 * `useRouter` lê o contexto *antes* de decidir atirar, por isso o `useContext`
 * lá dentro é sempre chamado, sempre na mesma posição, com ou sem router. O
 * que o `catch` apanha é só o `invariant` que vem depois.
 *
 * ## O que isto não é
 *
 * Não é uma forma de navegar no canvas. Quem usa isto trata o `null`: numa
 * storyboard, navegar não faz nada — e é a resposta certa, porque uma maqueta
 * não muda de URL. Na app real o router existe sempre.
 */
export function useCanvasSafeRouter(): ReturnType<typeof useRouter> | null {
  try {
    return useRouter();
  } catch {
    return null;
  }
}
