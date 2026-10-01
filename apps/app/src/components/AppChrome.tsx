"use client";

import { createElement, useState } from "react";
import { useTranslations } from "next-intl";
import { AppShell, type NavItem, type Notification } from "@upm/ui";
import { LOCALES } from "@upm/config";

import { navFor } from "../lib/navigation";
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
  contentWidth = "default",
  fill = false,
  children,
}: AppChromeProps) {
  const t = useTranslations();
  const [search, setSearch] = useState("");
  const { items, markAllRead } = useNotifications(notifications, liveNotifications);

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
        // TODO (Fase 6): abrir o modal de "Reportar problema" (03 F9).
        onReport: () => undefined,
        // TODO (Fase 3): terminar sessão no Supabase Auth (03 F3).
        onSignOut: () => undefined,
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
      {children}
    </AppShell>
  );
}
