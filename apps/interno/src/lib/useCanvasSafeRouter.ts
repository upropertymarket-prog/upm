"use client";

import { useRouter } from "next/navigation";

/**
 * O router do Next, ou `null` quando não há router — que é o caso do canvas.
 * =========================================================================
 * `useRouter()` do `next/navigation` não devolve `null` quando não há router
 * montado: **atira**. A implementação é um `useContext` seguido de um
 * `invariant`, e a mensagem é a que aparecia nas storyboards a 22 out 2026 —
 * `Error: invariant expected app router to be mounted`, com a árvore React
 * toda abaixo do componente a desaparecer.
 *
 * Isto não se via enquanto o sidecar do canvas foi um host **Next**: havia
 * router, e o `useRouter` devolvia-o. Quando o sidecar passou a **Vite**,
 * passou a não haver — e todas as storyboards de ecrãs que navegam ficaram em
 * branco de uma vez.
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
 * Não é uma forma de navegar no canvas. Quem usa isto tem de tratar o `null`:
 * numa storyboard, navegar não faz nada — e é essa a resposta certa, porque
 * uma maqueta não muda de URL. Na app real o router existe sempre, e o
 * comportamento é exatamente o de antes.
 */
export function useCanvasSafeRouter(): ReturnType<typeof useRouter> | null {
  try {
    return useRouter();
  } catch {
    return null;
  }
}
