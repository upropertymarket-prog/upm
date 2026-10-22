"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AppUpdatesModal, appUpdatesLabels, type AppUpdate } from "@upm/ui";

/**
 * **`app/actions/updates` entra por `import()`, nunca no topo** (22 out 2026).
 *
 * É um módulo `"use server"` e importa `next/headers`. Este componente é
 * montado pelo `AppChrome`, que envolve todos os ecrãs da app, por isso um
 * `import` estático aqui arrastava o `next/headers` para o pacote do browser —
 * e no canvas, que é um host Vite sem compilador do Next, o módulo corre a
 * sério e atira `ReferenceError: process is not defined`.
 *
 * As storyboards passam `appUpdates={false}` e este componente **nem monta**,
 * mas isso não bastava: o que parte não é a renderização, é o `import`. Um
 * módulo no grafo é avaliado ainda que ninguém o use.
 *
 * Ver `server-actions-fora-do-grafo-do-canvas` e o `AppChrome`, que levou a
 * mesma correção nos seus dois caminhos.
 */
const updatesActions = () => import("../../app/actions/updates");

/**
 * A porta das novidades (P10-07 · 04 §8.1.3)
 * =========================================================================
 * Vive dentro do `AppChrome` e não em cada página, por uma razão prática: 04
 * §8.1.3 diz *"ao entrar"*, e "entrar" na app é montar o shell — não é abrir
 * uma rota concreta. Posto aqui, funciona qualquer que seja a página por onde
 * a sessão começa, e cada página não precisa de saber que as novidades
 * existem.
 *
 * **Uma ida ao servidor por montagem do shell, e só quando há sessão.** Não é
 * um custo por página: o `AppChrome` monta uma vez por navegação do lado do
 * cliente. Lê por Server Action e não pelo cliente Supabase (ao contrário do
 * sino, em `useNotifications`) porque a leitura **não é uma tabela**: é a
 * função `app_updates_for_me()`, que resolve a audiência no servidor, mais os
 * URL assinados das imagens, que precisam de ser gerados lá.
 *
 * ## Porque não há realtime
 *
 * O sino tem; isto não. Uma novidade de produto não é um evento que interrompa
 * quem está a trabalhar: a decisão de quando interromper é a `delivery` que o
 * Marketing escolheu (04 §2.6), e nenhuma das três é "agora, a meio do que
 * estavas a fazer". Quem publica uma novidade enquanto alguém está na app quer
 * que ela apareça **no próximo login** dessa pessoa, que é exactamente o que
 * acontece sem subscrição nenhuma.
 */
export function AppUpdatesGate() {
  const t = useTranslations();
  const [updates, setUpdates] = useState<AppUpdate[] | null>(null);

  useEffect(() => {
    let alive = true;
    void updatesActions()
      .then(({ myAppUpdates }) => myAppUpdates())
      .then((rows) => {
        // A resposta pode chegar depois de o componente sair do ecrã (uma
        // navegação rápida), e escrever estado aí é um aviso do React e nada
        // mais — mas é um aviso que alguém vai perseguir daqui a seis meses.
        if (alive) setUpdates(rows);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!updates || updates.length === 0) return null;

  /**
   * `banner` é a única das três que **não** abre o modal: 04 §2.6 dá-lhe "faixa
   * agora + modal no próximo login". Como a decisão é por conjunto e não por
   * novidade, basta uma que não seja faixa para o modal abrir — e uma
   * obrigatória força-o de qualquer maneira, dentro do componente.
   */
  const openOnMount = updates.some((update) => update.delivery !== "banner");

  return (
    <AppUpdatesModal
      updates={updates}
      labels={appUpdatesLabels(t)}
      openOnMount={openOnMount}
      onAcknowledge={async (id) => {
        const { acknowledgeAppUpdate } = await updatesActions();
        await acknowledgeAppUpdate(id);
      }}
    />
  );
}
