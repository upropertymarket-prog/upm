import type { Notification } from "@upm/ui";

import type { InternalRole } from "../lib/navigation";

/**
 * O que o shell mostrou da última vez — para o esqueleto da página seguinte
 * =========================================================================
 * O `loading.tsx` aparece no instante do clique, antes de o servidor dizer
 * quem está a ver. Se desenhasse um shell genérico, o menu piscava a cada
 * mudança de página. Em vez disso, o `InternalChrome` deixa aqui o papel, o
 * nome e os contadores, e o `RouteLoading` redesenha o shell igual — só o
 * conteúdo passa a esqueleto.
 *
 * Vive em memória do módulo, no browser: escreve-se num efeito, que nunca
 * corre no servidor, e por isso não há mistura entre pedidos de pessoas
 * diferentes. Um F5 apaga-o, e aí o esqueleto é o `ShellSkeleton`.
 */
export type ChromeSnapshot = {
  role: InternalRole;
  userName: string;
  userMeta: string;
  locale: string;
  counters: Record<string, number>;
  notifications: Notification[];
};

let snapshot: ChromeSnapshot | null = null;

export function rememberChrome(next: ChromeSnapshot) {
  snapshot = next;
}

export function recallChrome(): ChromeSnapshot | null {
  return snapshot;
}
