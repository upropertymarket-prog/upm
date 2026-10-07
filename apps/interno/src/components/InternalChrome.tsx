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
import { submitProblemReport } from "../app/actions/support";

export type InternalChromeProps = {
  role: "admin" | "support";
  userName: string;
  /** "Administração · IT" — papel · departamento (04 §5.5). */
  userMeta: string;
  activeId: string;
  locale: string;
  onLocaleChange: (locale: string) => void | Promise<void>;
  counters?: Record<string, number>;
  notifications?: Notification[];
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
 * Chrome da área interna — Admin e Suporte (P1-05)
 * =========================================================================
 * É o **mesmo** `<AppShell>` da app de comprador e proprietário: 04 §5.5 exige
 * um shell idêntico nos quatro perfis. O que muda é a lista de 07 §4.1 e a
 * etiqueta de grupo ("Administração" / "Suporte").
 *
 * A navegação usa `<a>` e não `next/link`: com `typedRoutes` ligado, um `Link`
 * para uma rota inexistente falha o typecheck, e as rotas de 03 §1.3 nascem nas
 * Fases 9 e 10. O `<AppShell>` já tem `renderLink` para a troca.
 */
export function InternalChrome({
  role,
  userName,
  userMeta,
  activeId,
  locale,
  onLocaleChange,
  counters = {},
  notifications = [],
  children,
}: InternalChromeProps) {
  const t = useTranslations();
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Notification[]>(notifications);
  const [reportOpen, setReportOpen] = useState(false);

  // Ver a nota em `AppChrome`: a trilha recolhe desde que o shell monta, não
  // desde que o modal abre.
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
      sidebar={{
        groups: [{ label: t(`sidebar.groups.${groupKey}`), items: navItems }],
        activeId,
        user: { name: userName, meta: userMeta, initials: initials(userName), online: true },
        onReport: () => setReportOpen(true),
        // TODO (Fase 3): terminar sessão de `interno` — 2FA + PIN (07 §6).
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
        onMarkAllRead: () => setItems((current) => current.map((n) => ({ ...n, read: true }))),
      }}
    >
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
          const outcome = await submitProblemReport(form);
          return "error" in outcome ? outcome : { ref: outcome.ref, merged: outcome.merged };
        }}
      />
    </AppShell>
  );
}
