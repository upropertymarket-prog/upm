"use client";

import { useCallback, useState, useTransition } from "react";
import type { Route } from "next";

import { useCanvasSafeRouter } from "./useCanvasSafeRouter";

/** O que se pediu ao clicar: abrir a ficha `id` (com um rótulo para já), ou fechar. */
export type DrawerIntent = { id: string | null; label?: string };

/**
 * Abrir e fechar a gaveta de detalhe sem recarregar a página (19 nov 2026)
 * =========================================================================
 * Leads do site e Equipa abriam a ficha com `window.location.assign`: um
 * documento novo, com o JS, o CSS, o menu e as consultas todas outra vez — perto
 * de 3 s para mostrar um painel. A ficha continua no URL (`?id=`), para se poder
 * partilhar e para o voltar atrás funcionar; muda só o caminho até lá: um
 * `router.push` dentro de uma transição, que pede ao servidor apenas o payload
 * da página.
 *
 * `intent` é o que o clique pediu, **só enquanto a navegação corre**. O ecrã usa
 * isso para abrir a gaveta no próprio clique, com o nome da linha e "A
 * carregar…", em vez de esperar pela resposta; e para a fechar logo, sem a
 * ficha antiga ficar à vista até o servidor responder. Quando a transição
 * termina, `intent` volta a `null` e manda outra vez o que veio do servidor.
 *
 * No canvas não há router (ver `useCanvasSafeRouter`): cai no
 * `window.location.assign` de antes.
 */
export function useDrawerNavigation() {
  const router = useCanvasSafeRouter();
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<DrawerIntent | null>(null);

  const navigate = useCallback(
    (href: string, intent: DrawerIntent | null = null) => {
      setTarget(intent);
      if (!router) {
        window.location.assign(href);
        return;
      }
      startTransition(() => router.push(href as Route, { scroll: false }));
    },
    [router],
  );

  /** Volta a pedir a página ao servidor, sem documento novo — depois de gravar. */
  const refresh = useCallback(() => {
    setTarget(null);
    if (!router) {
      window.location.reload();
      return;
    }
    startTransition(() => router.refresh());
  }, [router]);

  return { navigate, refresh, pending, intent: pending ? target : null };
}
