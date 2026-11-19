"use client";

import { createElement, useEffect, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
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

import { navFor, type InternalRole } from "../lib/navigation";
import { rememberChrome } from "./chromeMemory";

export type InternalChromeProps = {
  role: InternalRole;
  userName: string;
  /** "Administração · IT" — papel · departamento (04 §5.5). */
  userMeta: string;
  activeId: string;
  locale: string;
  onLocaleChange: (locale: string) => void | Promise<void>;
  counters?: Record<string, number>;
  notifications?: Notification[];
  /**
   * Trava o shell no viewport e dá ao conteúdo a altura que sobra. É o que a
   * Caixa de e-mail precisa: um cliente de correio de três colunas tem de
   * herdar uma altura definida, senão as colunas ficam do tamanho do texto e o
   * ecrã deixa de parecer uma aplicação (04 §5.5, mesma razão das Mensagens).
   */
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
 * Chrome da área interna — Admin e Suporte (P1-05)
 * =========================================================================
 * É o **mesmo** `<AppShell>` da app de comprador e proprietário: 04 §5.5 exige
 * um shell idêntico nos quatro perfis. O que muda é a lista de 07 §4.1 e a
 * etiqueta de grupo ("Administração" / "Suporte").
 *
 * A navegação é `next/link` (19 nov 2026). Era `<a>`, enquanto as rotas de
 * 03 §1.3 não existiam todas e o `typedRoutes` recusava um `Link` para elas.
 * O preço do `<a>` era alto: cada clique no menu recarregava o documento
 * inteiro, e o ecrã ficava parado na página antiga até a nova chegar toda do
 * servidor — lia-se como uma app lenta. Com o `Link`, a troca é no cliente e o
 * `loading.tsx` da rota aparece no instante do clique.
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
  fill = false,
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

  // O esqueleto da próxima página redesenha este shell (ver `chromeMemory`).
  useEffect(() => {
    rememberChrome({ role, userName, userMeta, locale, counters, notifications });
  }, [role, userName, userMeta, locale, counters, notifications]);

  // O Admin tem quatro grupos (14 nov 2026); o Suporte e o Marketing, um.
  const navGroups = navFor(role).map((group) => ({
    label: t(`sidebar.groups.${group.labelKey}`),
    items: group.entries.map((entry): NavItem => ({
      id: entry.id,
      label: t(`nav.${entry.titleKey}`),
      href: entry.href,
      icon: createElement(entry.icon, { size: 17 }),
      count: entry.counter ? counters[entry.id] : undefined,
    })),
  }));

  return (
    <AppShell
      fill={fill}
      sidebar={{
        groups: navGroups,
        activeId,
        user: { name: userName, meta: userMeta, initials: initials(userName), online: true },
        // O `href` vem de `navigation.ts`, que é a lista das rotas que existem.
        renderLink: ({ href, className, title, children, "aria-current": current }) => (
          <Link href={href as Route} className={className} title={title} aria-current={current}>
            {children}
          </Link>
        ),
        onReport: () => setReportOpen(true),
        /**
         * A ação entra **ao clicar**, e não no topo do módulo (22 out 2026).
         * =================================================================
         * `app/actions/auth.ts` é `"use server"` e importa `next/headers`. Um
         * `import` estático daqui — de um componente `"use client"` que
         * envolve todos os ecrãs do interno — arrastava o `next/headers` para
         * o pacote do browser. No Next isso resolve-se por magia do
         * compilador; **no canvas não há compilador do Next**, e o módulo
         * corria a sério: `ReferenceError: process is not defined`, e todas as
         * storyboards com `InternalChrome` ficavam em branco.
         *
         * É a mesma armadilha que o `stepUpTypes.ts` documenta, e a mesma
         * saída: o módulo da action nunca entra no grafo de render. Com o
         * `import()` aqui dentro, só é pedido quando alguém carrega em Sair —
         * o que numa storyboard não acontece.
         */
        onSignOut: () => {
          void import("../app/actions/auth").then(({ signOut }) => signOut());
        },
        labels: {
          collapse: t("sidebar.collapse"),
          close: t("sidebar.close"),
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
          // Pelo mesmo motivo do `onSignOut` acima: `app/actions/support.ts`
          // também é `"use server"` e também importa `next/headers`. Este era
          // o caminho mais antigo dos dois — estava cá desde que o modal
          // nasceu, e foi preciso tirar os dois para as storyboards voltarem.
          const { submitProblemReport } = await import("../app/actions/support");
          const outcome = await submitProblemReport(form);
          return "error" in outcome ? outcome : { ref: outcome.ref, merged: outcome.merged };
        }}
      />
    </AppShell>
  );
}
