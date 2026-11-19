"use client";

import { useEffect, useState } from "react";

import { cx } from "../lib/cx";
import { ThemeToggle } from "../theme/ThemeToggle";
import { LanguageMenu } from "./LanguageMenu";
import { Sidebar, type SidebarProps } from "./Sidebar";
import { Topbar, type TopbarProps } from "./Topbar";

const COLLAPSED_KEY = "upm-sidebar-collapsed";

/**
 * O último valor do rail visto **neste separador** (19 nov 2026). O shell
 * monta de novo a cada página — e a cada esqueleto de carregamento —, e o
 * `localStorage` só se lê depois de montar: sem isto, quem tem o rail recolhido
 * via a sidebar abrir e fechar em cada mudança de página. Só se escreve no
 * browser (efeito e clique), por isso no servidor fica sempre `null` e o
 * primeiro render bate com o HTML.
 */
let lastCollapsed: boolean | null = null;

export type AppShellProps = {
  sidebar: Omit<SidebarProps, "collapsed" | "onCollapsedChange">;
  topbar: Omit<TopbarProps, "onOpenSidebar">;
  children: React.ReactNode;
  /** Estado inicial do rail. Persiste por dispositivo em `localStorage`. */
  defaultCollapsed?: boolean;
  /**
   * Largura do conteúdo (04 §1.5). `"default"` limita a `--content-max`
   * (1600 px) e centra; `"full"` deixa correr a toda a largura e é só para
   * ecrãs cujo conteúdo é a própria área visível — o Mapa. Listas,
   * formulários e tabelas ficam sempre no limite.
   */
  contentWidth?: "default" | "full";
  /**
   * `true` trava o shell no viewport (`100vh`) a partir de 900 px e deixa o
   * conteúdo ocupar a altura que sobra — é o que ecrãs cuja área útil é a
   * própria janela precisam (Mensagens, e amanhã o Mapa): sem isto, um painel
   * que se queira do tamanho do ecrã não tem altura definida de onde crescer.
   * Abaixo de 900 px volta tudo ao fluxo normal, que é onde as colunas se
   * empilham e a página tem mesmo de rolar.
   */
  fill?: boolean;
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
 * ⚠ O shell **não** tem largura nem altura próprias: ocupa o viewport
 * (`min-height: 100vh` em `shell.css`) e cresce com o conteúdo, como qualquer
 * app. Fixar aqui um `height` em pixels — como já aconteceu — comprime a
 * topbar, deixa faixas vazias por baixo do conteúdo e faz com que todas as
 * páginas da plataforma passem a ter a altura de uma só. O `style` existe para
 * o consumidor ajustar o que precisar, não para lhe dar um tamanho fixo.
 *
 * O canvas deste componente está em tempo/designs/design-system/app-shell/index.canvas.tsx.
 * Se alterar este componente, mantenha o canvas e a declaração de asset coerentes.
 */
export function AppShell({
  sidebar,
  topbar,
  children,
  defaultCollapsed = false,
  contentWidth = "default",
  fill = false,
  className,
  style,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(() => lastCollapsed ?? defaultCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COLLAPSED_KEY);
      if (stored === "1" || stored === "0") {
        lastCollapsed = stored === "1";
        setCollapsed(lastCollapsed);
      }
    } catch {
      // Storage bloqueado: fica o valor por omissão.
    }
  }, []);

  function changeCollapsed(next: boolean) {
    lastCollapsed = next;
    setCollapsed(next);
    try {
      window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      // idem
    }
  }

  // `Esc` fecha a gaveta do telemóvel, como qualquer painel por cima da página.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  // A gaveta é sempre a sidebar inteira: a preferência de rail é do desktop e
  // não se aplica a um painel que se abre por cima do conteúdo (11 nov 2026).
  const railed = collapsed && !mobileOpen;

  return (
    <div
      className={cx("upm-shell", className)}
      data-collapsed={railed ? "true" : "false"}
      data-mobile-open={mobileOpen ? "true" : "false"}
      data-content={contentWidth}
      data-fill={fill ? "true" : "false"}
      style={style}
      // Escolher um destino na gaveta fecha-a: o ecrã novo fica à vista.
      onClick={(event) => {
        if (mobileOpen && (event.target as HTMLElement).closest(".upm-sidebar .upm-nav__item")) {
          setMobileOpen(false);
        }
      }}
    >
      {/* O véu atrás da gaveta (só abaixo de 768 px, `shell.css`): tocar fora
          dela fecha-a. */}
      {mobileOpen ? (
        <div
          className="upm-shell__backdrop"
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      <Sidebar
        {...sidebar}
        collapsed={railed}
        onCollapsedChange={changeCollapsed}
        onCloseMobile={() => setMobileOpen(false)}
        // Idioma e tema na gaveta do telemóvel, com os mesmos dados da topbar,
        // de onde saem abaixo de 768 px (11 nov 2026).
        preferences={
          <>
            <div className="upm-sidebar__pref">
              <span className="upm-sidebar__pref-label">{topbar.labels.language}</span>
              <LanguageMenu
                variant="segmented"
                locale={topbar.locale}
                locales={topbar.locales}
                onLocaleChange={topbar.onLocaleChange}
                label={topbar.labels.language}
              />
            </div>
            <div className="upm-sidebar__pref">
              <span className="upm-sidebar__pref-label">{topbar.labels.theme.title}</span>
              <ThemeToggle variant="segmented" labels={topbar.labels.theme} />
            </div>
          </>
        }
      />
      <div className="upm-shell__gutter" aria-hidden="true" />
      <div className="upm-shell__main">
        <Topbar {...topbar} onOpenSidebar={() => setMobileOpen((value) => !value)} />
        <main className="upm-shell__content">{children}</main>
      </div>
    </div>
  );
}
