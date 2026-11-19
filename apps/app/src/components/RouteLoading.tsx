"use client";

import { usePathname } from "next/navigation";
import { ShellSkeleton } from "@upm/ui";

import { navFor } from "../lib/navigation";
import { AppChrome } from "./AppChrome";
import { recallChrome } from "./chromeMemory";

/** O item do menu cujo `href` é o prefixo mais comprido do caminho. */
function activeIdFor(role: "buyer" | "owner", pathname: string): string {
  let best = { id: "", length: -1 };
  for (const entry of navFor(role).entries) {
    const matches = pathname === entry.href || pathname.startsWith(`${entry.href}/`);
    if (matches && entry.href.length > best.length)
      best = { id: entry.id, length: entry.href.length };
  }
  return best.id;
}

/**
 * O shell de um `loading.tsx` — o mesmo menu, com o conteúdo em esqueleto
 * =========================================================================
 * Numa navegação dentro da app, redesenha o `AppChrome` com o que a página
 * anterior deixou em `chromeMemory`, e marca já o item para onde se vai. O
 * sino e as novidades ficam desligados aqui: a página que vem a seguir monta
 * os seus, e ligá-los no esqueleto era abrir e fechar uma subscrição em cada
 * clique.
 *
 * Na primeira carga (ou depois de um F5) não há memória: aí é o
 * `ShellSkeleton`, com as medidas do shell e nenhum texto.
 */
export function RouteLoading({
  fill = false,
  contentWidth = "default",
  onLocaleChange,
  children,
}: {
  fill?: boolean;
  contentWidth?: "default" | "full";
  onLocaleChange: (locale: string) => void | Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const chrome = recallChrome();

  if (!chrome) return <ShellSkeleton fill={fill}>{children}</ShellSkeleton>;

  return (
    <AppChrome
      role={chrome.role}
      userName={chrome.userName}
      userMeta={chrome.userMeta}
      activeId={activeIdFor(chrome.role, pathname)}
      locale={chrome.locale}
      onLocaleChange={onLocaleChange}
      counters={chrome.counters}
      notifications={chrome.notifications}
      liveNotifications={false}
      appUpdates={false}
      contentWidth={contentWidth}
      fill={fill}
    >
      {children}
    </AppChrome>
  );
}
