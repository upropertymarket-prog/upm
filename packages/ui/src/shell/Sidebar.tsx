"use client";

import { Fragment } from "react";
import { LifeBuoy, LogOut, PanelLeftClose, X } from "lucide-react";

import { cx } from "../lib/cx";
import { Badge } from "../components/StatusTag";
import { Brand } from "./Brand";

/** Um pouco mais do que `--motion-panel` (240 ms): desliga-se depois de acabar. */
const RAIL_MOTION_MS = 320;

/**
 * Liga a transição do rail só para a mudança que o clique vai provocar (19 nov
 * 2026) — ver `data-animating` em `shell.css`. O atributo vive no
 * `.upm-shell`, que é de quem a largura muda, e sai sozinho: uma carga de
 * página nunca o encontra ligado.
 */
function animateRail(from: HTMLElement) {
  const shell = from.closest<HTMLElement>(".upm-shell");
  if (!shell) return;
  shell.dataset.animating = "true";
  window.setTimeout(() => {
    delete shell.dataset.animating;
  }, RAIL_MOTION_MS);
}

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  /** Contador laranja de novos/não lidos/pendentes (07 §4.2). */
  count?: number;
};

export type NavGroup = {
  /** "Procurar" / "Gerir" / "Administração" / "Suporte" (04 §5.5). */
  label: string;
  items: NavItem[];
};

export type SidebarUser = {
  name: string;
  /** "Proprietária · Premium" — papel · plano (04 §5.5). */
  meta: string;
  initials: string;
  online?: boolean;
};

export type SidebarLabels = {
  collapse: string;
  expand: string;
  report: string;
  signOut: string;
  /** Sufixo de leitor de ecrã para os contadores: "3 por ler". */
  countSuffix: string;
  /** Botão de fechar a gaveta (telemóvel). Sem ele, usa `collapse`. */
  close?: string;
};

export type SidebarProps = {
  groups: NavGroup[];
  /** `id` do item ativo. */
  activeId: string;
  user: SidebarUser;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onReport: () => void;
  onSignOut: () => void;
  labels: SidebarLabels;
  /**
   * Idioma e tema, quando a sidebar é gaveta (abaixo de 768 px). Fora disso
   * não se mostram: estão na topbar. O `AppShell` monta-os a partir das props
   * da topbar.
   */
  preferences?: React.ReactNode;
  /**
   * Fecha a gaveta do telemóvel. Abaixo de 768 px o botão de recolher (que
   * faz rail) dá lugar a um ✕ que chama isto — numa gaveta, recolher não faz
   * sentido; fechar, sim.
   */
  onCloseMobile?: () => void;
  /**
   * Componente de link da app (`next/link`). Por omissão, `<a>`.
   *
   * Recebe também o `id` do item, e não só o `href`, para quem encaminha por
   * **estado** em vez de por rota — a demonstração do site público, que troca
   * de ecrã dentro de uma caixa e não tem rotas para onde ir. Sem o `id`, a
   * única via era adivinhá-lo a partir do `href`.
   */
  renderLink?: (props: {
    id: string;
    href: string;
    className: string;
    children: React.ReactNode;
    "aria-current"?: "page";
    title: string;
  }) => React.ReactNode;
};

/**
 * Sidebar — 04 §5.5
 * =========================================================================
 * Idêntica nos 4 perfis; o que muda é a lista de `groups`. Ordem fixa: marca +
 * botão de colapsar → etiqueta de grupo → itens com contador → rodapé com
 * "Reportar problema" a toda a largura e o cartão do utilizador.
 *
 * `renderLink` existe para o `next/link` entrar sem `packages/ui` depender do
 * Next: a navegação é da app, o desenho é daqui.
 */
export function Sidebar({
  groups,
  activeId,
  user,
  collapsed,
  onCollapsedChange,
  onReport,
  onSignOut,
  labels,
  preferences,
  onCloseMobile,
  renderLink,
}: SidebarProps) {
  return (
    <aside className="upm-sidebar" style={{ justifyContent: "space-between" }}>
      {/* No rail não há botão próprio de expandir: no espaço de 84 px, duas
          caixas empilhadas liam-se como dois controlos sem relação. É o ícone
          da marca que expande — continua a ser um `<button>`, por isso mantém
          teclado, foco visível e `aria-expanded`. */}
      <div className="upm-sidebar__brand" style={{ justifyContent: "space-between" }}>
        {collapsed ? (
          <button
            type="button"
            className="upm-sidebar__brand-toggle"
            aria-label={labels.expand}
            title={labels.expand}
            aria-expanded={false}
            onClick={(event) => {
              animateRail(event.currentTarget);
              onCollapsedChange(false);
            }}
          >
            <Brand collapsed />
          </button>
        ) : (
          <>
            <Brand />
            <button
              type="button"
              className="upm-btn upm-btn--secondary upm-btn--icon upm-sidebar__collapse"
              aria-label={labels.collapse}
              title={labels.collapse}
              aria-expanded
              onClick={(event) => {
                animateRail(event.currentTarget);
                onCollapsedChange(true);
              }}
            >
              <PanelLeftClose size={15} />
            </button>
            {onCloseMobile ? (
              <button
                type="button"
                className="upm-btn upm-btn--secondary upm-btn--icon upm-sidebar__close"
                aria-label={labels.close ?? labels.collapse}
                title={labels.close ?? labels.collapse}
                onClick={onCloseMobile}
              >
                <X size={15} />
              </button>
            ) : null}
          </>
        )}
      </div>

      {groups.map((group) => (
        <nav
          className="upm-nav"
          key={group.label}
          aria-label={group.label}
          style={{ rowGap: "8px" }}
        >
          <span className="upm-sidebar__group">{group.label}</span>
          {group.items.map((item) => {
            const active = item.id === activeId;
            const content = (
              <>
                <span className="upm-nav__icon" aria-hidden="true">
                  {item.icon}
                </span>
                {collapsed ? null : <span className="upm-nav__label">{item.label}</span>}
                {item.count ? <Badge srLabel={labels.countSuffix}>{item.count}</Badge> : null}
              </>
            );

            const linkProps = {
              href: item.href,
              className: "upm-nav__item",
              title: item.label,
              ...(active ? ({ "aria-current": "page" } as const) : {}),
            };

            /* `Fragment` e não um `<span>` em volta: `.upm-nav` é uma coluna
               flex, e com o invólucro era ele o item da coluna — o elemento
               devolvido deixava de esticar à largura do menu e passava a ter a
               largura do seu conteúdo. A `key` continua a ser precisa, e é o
               que o fragmento leva. */
            return renderLink ? (
              <Fragment key={item.id}>
                {renderLink({ ...linkProps, id: item.id, children: content })}
              </Fragment>
            ) : (
              <a key={item.id} {...linkProps}>
                {content}
              </a>
            );
          })}
        </nav>
      ))}

      <div className="upm-sidebar__footer">
        {preferences ? <div className="upm-sidebar__prefs">{preferences}</div> : null}
        <button type="button" className="upm-sidebar__report" onClick={onReport}>
          <LifeBuoy size={15} aria-hidden="true" />
          {collapsed ? <span className="upm-sr-only">{labels.report}</span> : labels.report}
        </button>

        <div className="upm-usercard">
          <span className="upm-avatar" aria-hidden="true">
            {user.initials}
            {user.online ? <span className="upm-avatar__dot" /> : null}
          </span>
          {collapsed ? null : (
            <>
              <span className="upm-usercard__text">
                <span className="upm-usercard__name">{user.name}</span>
                <span className="upm-usercard__meta">{user.meta}</span>
              </span>
              <button
                type="button"
                className={cx("upm-btn", "upm-btn--ghost", "upm-btn--icon")}
                aria-label={labels.signOut}
                title={labels.signOut}
                onClick={onSignOut}
              >
                <LogOut size={15} />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
