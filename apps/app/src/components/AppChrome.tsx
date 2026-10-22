"use client";

import { createElement, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AppShell,
  ReportProblemModal,
  installBreadcrumbs,
  reportProblemLabels,
  type NavItem,
  type Notification,
} from "@upm/ui";
import { LOCALES } from "@upm/config";

import { navFor } from "../lib/navigation";
import { AppUpdatesGate } from "./notifications/AppUpdatesGate";
import { useNotifications } from "./notifications/useNotifications";

export type AppChromeProps = {
  role: "buyer" | "owner";
  /** Nome completo do utilizador (`profiles.full_name`). */
  userName: string;
  /** "Proprietária · Premium" — papel · plano (04 §5.5). */
  userMeta: string;
  activeId: string;
  locale: string;
  /** Server Action de `actions/preferences`. */
  onLocaleChange: (locale: string) => void | Promise<void>;
  /** Contadores por `id` de item de navegação (07 §4.2). */
  counters?: Record<string, number>;
  /** Primeiro render do sino; a partir daí é o `useNotifications` que manda. */
  notifications?: Notification[];
  /**
   * `false` numa storyboard: o sino fica com o que `notifications` trouxer e
   * nunca fala com o Supabase (não há sessão no canvas).
   */
  liveNotifications?: boolean;
  /**
   * `false` numa storyboard: a porta das novidades não monta, e por isso não
   * chama `myAppUpdates()`. Mesma razão que `liveNotifications` — a Server
   * Action abre um cliente Supabase, e no canvas não há env nem sessão para
   * isso. É um gate separado por ser uma ida ao servidor diferente: aquela é
   * uma subscrição realtime a uma tabela, esta é uma chamada única a
   * `app_updates_for_me()`.
   */
  appUpdates?: boolean;
  /** 04 §1.5 — `"full"` só para o Mapa; tudo o resto fica no limite de 1600 px. */
  contentWidth?: "default" | "full";
  /** Trava o shell no viewport e dá ao conteúdo a altura que sobra (Mensagens). */
  fill?: boolean;
  children: React.ReactNode;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Chrome da app autenticada — comprador e proprietário (P1-05)
 * =========================================================================
 * Liga o `<AppShell>` de `@upm/ui` às traduções e à navegação de 07 §4.2/§4.3.
 * O shell em si não sabe nada de perfis: 04 §5.5 diz que é idêntico nos quatro,
 * e é esta camada que escolhe a lista.
 *
 * A navegação usa `<a>` e não `next/link`: com `typedRoutes` ligado, um `Link`
 * para uma rota que ainda não existe falha o typecheck, e as rotas de 03 §1.2
 * nascem nas Fases 3–7. Passa a `next/link` (via `renderLink`) quando as
 * páginas existirem — o `<AppShell>` já tem o ponto de entrada para isso.
 */
export function AppChrome({
  role,
  userName,
  userMeta,
  activeId,
  locale,
  onLocaleChange,
  counters = {},
  notifications = [],
  liveNotifications = true,
  appUpdates = true,
  contentWidth = "default",
  fill = false,
  children,
}: AppChromeProps) {
  const t = useTranslations();
  const [search, setSearch] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const { items, markAllRead } = useNotifications(notifications, liveNotifications);

  // A trilha de "últimas ações" (04 §2.7 #2) tem de estar a recolher **antes**
  // de alguém abrir o modal: o valor dela é dizer o que aconteceu até ao
  // problema, e começar a gravar quando o utilizador já está a reportar daria
  // uma trilha vazia. Idempotente — o shell monta uma vez por app.
  useEffect(() => {
    installBreadcrumbs();
  }, []);

  const { entries, groupKey } = navFor(role);

  const navItems: NavItem[] = entries.map((entry) => ({
    id: entry.id,
    label: t(`nav.${entry.titleKey}`),
    href: entry.href,
    icon: createElement(entry.icon, { size: 17 }),
    count: entry.counter ? counters[entry.id] : undefined,
  }));

  return (
    <AppShell
      contentWidth={contentWidth}
      fill={fill}
      sidebar={{
        groups: [{ label: t(`sidebar.groups.${groupKey}`), items: navItems }],
        activeId,
        user: { name: userName, meta: userMeta, initials: initials(userName), online: true },
        onReport: () => setReportOpen(true),
        /**
         * A ação entra **ao clicar**, e não no topo do módulo (22 out 2026).
         * =================================================================
         * `app/actions/auth.ts` é `"use server"` e importa `next/headers`. Um
         * `import` estático daqui — de um componente `"use client"` que
         * envolve todos os ecrãs da app — arrastava o `next/headers` para o
         * pacote do browser. No Next isso resolve-se por magia do compilador;
         * **no canvas não há compilador do Next**, e o módulo corre a sério:
         * `ReferenceError: process is not defined`, e as storyboards com
         * `AppChrome` ficam em branco. Eram onze, em três canvases — todo o
         * `06 - proprietario`, mais `02 - autenticacao` e `07 - legal`.
         *
         * Medido antes e depois no host do canvas: `06/Painel` tinha 17
         * elementos e zero texto; com isto, renderiza. Mesma armadilha e mesma
         * saída do `InternalChrome`, que a levou primeiro.
         */
        onSignOut: () => {
          void import("../app/actions/auth").then(({ signOut }) => signOut());
        },
        labels: {
          collapse: t("sidebar.collapse"),
          expand: t("sidebar.expand"),
          report: t("sidebar.report"),
          signOut: t("sidebar.signOut"),
          countSuffix: t("sidebar.countSuffix"),
        },
      }}
      topbar={{
        labels: {
          search: t("topbar.search"),
          openMenu: t("topbar.openMenu"),
          language: t("locale.title"),
          notifications: t("topbar.notifications"),
          markAllRead: t("topbar.markAllRead"),
          noNotifications: t("topbar.noNotifications"),
          theme: {
            title: t("theme.title"),
            light: t("theme.light"),
            dark: t("theme.dark"),
            system: t("theme.system"),
          },
        },
        searchValue: search,
        onSearchChange: setSearch,
        locale,
        locales: LOCALES.map((value) => ({ value, label: t(`locale.${value}`) })),
        onLocaleChange: (next) => void onLocaleChange(next),
        notifications: items,
        onMarkAllRead: () => void markAllRead(),
      }}
    >
      {/* As novidades (P10-07 · 04 §8.1.3): "ao entrar" é montar o shell, e
          não abrir uma rota concreta — por isso a porta é aqui e não em cada
          página. Decide sozinha se abre o modal, deixa a faixa, ou não mostra
          nada. */}
      {appUpdates ? <AppUpdatesGate /> : null}
      {children}
      <ReportProblemModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        labels={reportProblemLabels(t)}
        onSubmit={async ({ description, snapshot, screenshot }) => {
          const form = new FormData();
          form.set("description", description);
          form.set("snapshot", JSON.stringify(snapshot));
          if (screenshot) form.set("screenshot", screenshot);
          // Pelo mesmo motivo do `onSignOut` acima: `app/actions/support.ts`
          // também é `"use server"` e também importa `next/headers`. Este era
          // o mais antigo dos dois caminhos, e os dois tinham de sair para as
          // storyboards voltarem.
          const { submitProblemReport } = await import("../app/actions/support");
          const outcome = await submitProblemReport(form);
          return "error" in outcome ? outcome : { ref: outcome.ref, merged: outcome.merged };
        }}
      />
    </AppShell>
  );
}
