"use client";

import { usePathname } from "next/navigation";
import { ShellSkeleton } from "@upm/ui";

import { navFor, type InternalRole } from "../lib/navigation";
import { recallChrome } from "./chromeMemory";
import { InternalChrome } from "./InternalChrome";

/** O item do menu cujo `href` é o prefixo mais comprido do caminho. */
function activeIdFor(role: InternalRole, pathname: string): string {
  let best = { id: "", length: -1 };
  for (const group of navFor(role)) {
    for (const entry of group.entries) {
      const matches = pathname === entry.href || pathname.startsWith(`${entry.href}/`);
      if (matches && entry.href.length > best.length)
        best = { id: entry.id, length: entry.href.length };
    }
  }
  return best.id;
}

/**
 * O shell de um `loading.tsx` — o mesmo menu, com o conteúdo em esqueleto
 * =========================================================================
 * Numa navegação dentro do interno, redesenha o `InternalChrome` com o que a
 * página anterior deixou em `chromeMemory`, e marca já o item para onde se
 * vai: o clique responde no próprio menu, e só o conteúdo espera.
 *
 * Na primeira carga (ou depois de um F5) não há memória, e o servidor não tem
 * como saber o papel sem uma ida à base: aí é o `ShellSkeleton`, que tem as
 * medidas do shell e nenhum texto.
 */
export function RouteLoading({
  fill = false,
  onLocaleChange,
  children,
}: {
  fill?: boolean;
  onLocaleChange: (locale: string) => void | Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const chrome = recallChrome();

  if (!chrome) return <ShellSkeleton fill={fill}>{children}</ShellSkeleton>;

  return (
    <InternalChrome
      role={chrome.role}
      userName={chrome.userName}
      userMeta={chrome.userMeta}
      activeId={activeIdFor(chrome.role, pathname)}
      locale={chrome.locale}
      onLocaleChange={onLocaleChange}
      counters={chrome.counters}
      notifications={chrome.notifications}
      fill={fill}
    >
      {children}
    </InternalChrome>
  );
}
