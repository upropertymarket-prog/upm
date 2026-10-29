"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { cx } from "../lib/cx";
import { useDismissable } from "../lib/useDismissable";
import { useOptionalTheme } from "../theme/ThemeProvider";
import { Button } from "./Button";

/**
 * Só monta o portal depois de haver `document` — os overlays são client-only.
 *
 * **O destino é o `body`, exceto onde alguém o reclamar com
 * `data-upm-overlay-root`.** Na aplicação nada tem esse atributo, logo nada
 * muda: modais e drawers continuam a sair no fim do `body`, por cima de tudo.
 *
 * Quem o usa são as storyboards (13 out 2026). O canvas projeta **a raiz da
 * storyboard**, e um portal para o `body` cai fora dessa raiz: as storyboards
 * do Detalhe do utilizador, do Detalhe de moderação e da Confirmação de PIN
 * mostravam o ecrã de fundo e nenhuma sobreposição — uma storyboard que não
 * mostra o seu próprio assunto. Com o atributo no invólucro do canvas, o
 * overlay nasce dentro da raiz projetada e vê-se.
 *
 * É propositadamente um atributo e não uma prop: assim o componente de produto
 * continua a ser chamado exatamente como é chamado na app, que é a única forma
 * de a storyboard provar alguma coisa sobre ele.
 *
 * **A raiz é a mais próxima, não a primeira do documento** (28 out 2026). O
 * canvas monta todas as storyboards no mesmo documento: com `querySelector`, o
 * modal do Claro e o do Escuro caíam os dois na primeira raiz e uma das
 * molduras ficava sem nenhum. Um âncora escondido no sítio onde o overlay é
 * declarado sobe com `closest` até à raiz da sua própria storyboard.
 */
function usePortalTarget() {
  const [anchor, setAnchor] = useState<HTMLSpanElement | null>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!anchor) return;
    setTarget(anchor.closest<HTMLElement>("[data-upm-overlay-root]") ?? document.body);
  }, [anchor]);
  return { anchor: <span ref={setAnchor} hidden />, target };
}

type PanelChrome = {
  title: string;
  subtitle?: string;
  /** Ícone à esquerda do título, dentro de um quadrado `--accent-soft`. */
  icon?: React.ReactNode;
  /** Ações do rodapé, alinhadas à direita. */
  footer?: React.ReactNode;
  children: React.ReactNode;
};

function PanelHeader({
  title,
  subtitle,
  icon,
  titleId,
  onClose,
  closeLabel,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  titleId: string;
  onClose: () => void;
  closeLabel: string;
}) {
  return (
    <div className="upm-panel__header">
      {icon}
      <div className="upm-pagehead__text">
        <h2 className="upm-panel__title" id={titleId}>
          {title}
        </h2>
        {subtitle ? <span className="upm-panel__subtitle">{subtitle}</span> : null}
      </div>
      <Button variant="ghost" iconOnly aria-label={closeLabel} onClick={onClose}>
        <X size={17} />
      </Button>
    </div>
  );
}

export type DrawerProps = PanelChrome & {
  open: boolean;
  onClose: () => void;
  /** Etiqueta do botão de fechar — traduzida por quem usa (i18n). */
  closeLabel?: string;
  className?: string;
  footerStyle?: React.CSSProperties;
};

/**
 * Drawer — painel lateral à direita, 460 px (04 §5.4)
 * =========================================================================
 * "Ver/editar um registo vindo de uma lista": leads, utilizadores, tickets,
 * visitas, imóveis em moderação. Altura total e `border-left`.
 *
 * Fecha por `Esc`, por clique no véu e pelo X. Tem focus trap e devolve o foco
 * à linha de onde veio — ver `useDismissable` (04 §5.7).
 *
 * O canvas deste componente está em tempo/designs/design-system/sobreposicoes/index.canvas.tsx.
 * Se alterar este componente, mantenha o canvas e a declaração de asset coerentes.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  icon,
  footer,
  children,
  closeLabel = "Fechar",
  className,
  footerStyle,
}: DrawerProps) {
  const ref = useDismissable({ open, onClose });
  const { anchor, target } = usePortalTarget();
  const theme = useOptionalTheme()?.resolved;
  const titleId = `upm-drawer-${title.replace(/\W+/g, "-").toLowerCase()}`;

  if (!open || !target) return anchor;

  return (
    <>
      {anchor}
      {createPortal(
        <div className="upm-overlay upm-overlay--right" data-theme={theme} onClick={onClose}>
          <div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className={cx("upm-drawer", className)}
            onClick={(event) => event.stopPropagation()}
          >
            <PanelHeader
              title={title}
              subtitle={subtitle}
              icon={icon}
              titleId={titleId}
              onClose={onClose}
              closeLabel={closeLabel}
            />
            <div className="upm-panel__body">{children}</div>
            {footer ? (
              <div className="upm-panel__footer" style={footerStyle}>
                {footer}
              </div>
            ) : null}
          </div>
        </div>,
        target,
      )}
    </>
  );
}

export type ModalProps = PanelChrome & {
  open: boolean;
  onClose: () => void;
  size?: "sm" | "md" | "lg";
  closeLabel?: string;
  className?: string;
};

/**
 * Modal — diálogo ao centro (04 §5.4)
 * =========================================================================
 * "Tarefas curtas e decisões": confirmar, rejeitar com motivo, partilhar,
 * criar/editar plano, pedir visita, reportar problema, novidades no login.
 * Mesmo comportamento de teclado e foco do Drawer.
 *
 * O canvas deste componente está em tempo/designs/design-system/sobreposicoes/index.canvas.tsx.
 * Se alterar este componente, mantenha o canvas e a declaração de asset coerentes.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  footer,
  children,
  size = "md",
  closeLabel = "Fechar",
  className,
}: ModalProps) {
  const ref = useDismissable({ open, onClose });
  const { anchor, target } = usePortalTarget();
  const theme = useOptionalTheme()?.resolved;
  const titleId = `upm-modal-${title.replace(/\W+/g, "-").toLowerCase()}`;

  if (!open || !target) return anchor;

  return (
    <>
      {anchor}
      {createPortal(
        <div className="upm-overlay upm-overlay--center" data-theme={theme} onClick={onClose}>
          <div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className={cx("upm-modal", `upm-modal--${size}`, className)}
            onClick={(event) => event.stopPropagation()}
          >
            <PanelHeader
              title={title}
              subtitle={subtitle}
              icon={icon}
              titleId={titleId}
              onClose={onClose}
              closeLabel={closeLabel}
            />
            <div className="upm-panel__body">{children}</div>
            {footer ? <div className="upm-panel__footer">{footer}</div> : null}
          </div>
        </div>,
        target,
      )}
    </>
  );
}
