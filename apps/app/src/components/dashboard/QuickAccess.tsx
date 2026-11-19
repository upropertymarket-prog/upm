import type { Route } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Bookmark,
  Building2,
  CalendarDays,
  Map,
  MessageSquare,
  PlusCircle,
  Store,
} from "lucide-react";

/**
 * "Acesso rápido" (P4-06) — os quatro atalhos do Painel, 04 §8.3.
 *
 * O desenho aponta dois destes atalhos para Agenda de visitas e Mensagens, que
 * são Fase 5. Um atalho para uma rota que ainda não existe é um beco, por isso
 * os quatro lugares ficam pelas rotas de Fase 4 até P5-01/P5-02 aterrarem.
 *
 * `next/link` desde 19 nov 2026, como o `AppChrome`: com `<a>`, cada atalho
 * recarregava o documento e o ecrã ficava parado até a página nova chegar.
 */
const OWNER_SHORTCUTS = [
  { href: "/market", icon: Store, key: "market", navKey: "market" },
  { href: "/propriedades", icon: Building2, key: "myProperties", navKey: "myProperties" },
  { href: "/propriedades/nova", icon: PlusCircle, key: "publishProperty" },
  { href: "/mapa", icon: Map, key: "map", navKey: "map" },
] as const;

/**
 * Os quatro atalhos do comprador — 04 §2.4 (Painel: "Market, Guardados,
 * Pedidos de visitas, Mensagens"). Todas as rotas existem desde a Fase 5, por
 * isso nenhum destes é um beco como os da nota acima.
 */
const BUYER_SHORTCUTS = [
  { href: "/market", icon: Store, key: "market", navKey: "market" },
  { href: "/guardados", icon: Bookmark, key: "saved", navKey: "saved" },
  { href: "/meus-pedidos", icon: CalendarDays, key: "visitRequests" },
  { href: "/mensagens", icon: MessageSquare, key: "messages", navKey: "messages" },
] as const;

export function QuickAccess({ role = "owner" }: { role?: "owner" | "buyer" }) {
  const t = useTranslations("dashboard.quickAccess");
  const tNav = useTranslations("nav");
  const shortcuts = role === "buyer" ? BUYER_SHORTCUTS : OWNER_SHORTCUTS;
  /**
   * Cinco destes atalhos chamam-se exatamente como a entrada do menu, e por
   * isso leem a mesma chave: duas traduções de "Guardados" era garantir que um
   * dia ficavam diferentes. Os outros dois são uma chamada à ação e não um
   * rótulo de menu ("Publicar novo imóvel", e não "Nova propriedade"), e têm
   * título próprio.
   */
  const titleOf = (shortcut: (typeof shortcuts)[number]) =>
    "navKey" in shortcut ? tNav(shortcut.navKey) : t(`${shortcut.key}.title`);
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <h2
        style={{
          fontSize: "var(--fs-subtitle)",
          fontWeight: "var(--fw-bold)",
          color: "var(--text)",
          margin: 0,
        }}
      >
        {t("title")}
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
          gap: 14,
        }}
      >
        {shortcuts.map((shortcut) => {
          const Icon = shortcut.icon;
          return (
            <Link
              key={shortcut.href}
              href={shortcut.href as Route}
              className="upm-card upm-card--pad upm-card--interactive"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 11,
                textDecoration: "none",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "var(--r-lg)",
                    background: "var(--accent-soft)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: "none",
                  }}
                >
                  <Icon size={17} color="var(--accent)" aria-hidden="true" />
                </span>
                <strong style={{ fontSize: "var(--fs-body)", color: "var(--text)" }}>
                  {titleOf(shortcut)}
                </strong>
              </span>
              <span
                style={{
                  fontSize: "var(--fs-label)",
                  color: "var(--muted)",
                  lineHeight: "var(--lh-normal)",
                }}
              >
                {t(`${shortcut.key}.body`)}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
