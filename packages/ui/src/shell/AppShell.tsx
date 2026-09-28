"use client";

import { useEffect, useState } from "react";

import { cx } from "../lib/cx";
import { Sidebar, type SidebarProps } from "./Sidebar";
import { Topbar, type TopbarProps } from "./Topbar";

const COLLAPSED_KEY = "upm-sidebar-collapsed";

export type AppShellProps = {
  sidebar: Omit<SidebarProps, "collapsed" | "onCollapsedChange">;
  topbar: Omit<TopbarProps, "onOpenSidebar">;
  children: React.ReactNode;
  /** Estado inicial do rail. Persiste por dispositivo em `localStorage`. */
  defaultCollapsed?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * AppShell — 04 §5.5 · P1-05
 * =========================================================================
 * Junta sidebar + topbar + conteúdo e é **o mesmo nos 4 perfis**: comprador,
 * proprietário, admin e suporte recebem o mesmo shell e mudam só a navegação.
 * É isso que faz o produto parecer um só produto.
 *
 * O `grid` com uma coluna-fantasma reserva a largura da sidebar, que é
 * `position: fixed` para não se mover com o scroll (requisito explícito do Mapa
 * em 04 §8.4). Abaixo de 768 px a coluna desaparece e a sidebar passa a drawer,
 * controlado por `data-mobile-open` (02 §13).
 *
 * A preferência de rail é do dispositivo, não da conta: é sobre o tamanho do
 * ecrã em que se está, não sobre quem se é — por isso fica em `localStorage` e
 * não em `profiles`.
 *
 * O canvas deste componente está em tempo/designs/design-system/app-shell/index.canvas.tsx.
 * Se alterar este componente, mantenha o canvas e a declaração de asset coerentes.
 */
export function AppShell({
  sidebar,
  topbar,
  children,
  defaultCollapsed = false,
  className,
  style,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COLLAPSED_KEY);
      if (stored === "1" || stored === "0") setCollapsed(stored === "1");
    } catch {
      // Storage bloqueado: fica o valor por omissão.
    }
  }, []);

  function changeCollapsed(next: boolean) {
    setCollapsed(next);
    try {
      window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      // idem
    }
  }

  return (
    <div
      className={cx("upm-shell", className)}
      data-collapsed={collapsed ? "true" : "false"}
      data-mobile-open={mobileOpen ? "true" : "false"}
      style={{ width: "1440px", height: "1287px", ...style }}
    >
      <Sidebar {...sidebar} collapsed={collapsed} onCollapsedChange={changeCollapsed} />
      <div className="upm-shell__gutter" aria-hidden="true" />
      <div className="upm-shell__main" style={{ width: "100%" }}>
        <Topbar {...topbar} onOpenSidebar={() => setMobileOpen((value) => !value)} />
        <main className="upm-shell__content" style={{ width: "100%" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
