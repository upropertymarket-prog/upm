"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { cx } from "../lib/cx";
import { useDismissable } from "../lib/useDismissable";
import { Button } from "./Button";

/** Só monta o portal depois de haver `document` — os overlays são client-only. */
function usePortalTarget(): HTMLElement | null {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => setTarget(document.body), []);
  return target;
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
}: DrawerProps) {
  const ref = useDismissable({ open, onClose });
  const target = usePortalTarget();
  const titleId = `upm-drawer-${title.replace(/\W+/g, "-").toLowerCase()}`;

  if (!open || !target) return null;

  return createPortal(
    <div className="upm-overlay upm-overlay--right" onClick={onClose}>
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
        {footer ? <div className="upm-panel__footer">{footer}</div> : null}
      </div>
    </div>,
    target,
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
  const target = usePortalTarget();
  const titleId = `upm-modal-${title.replace(/\W+/g, "-").toLowerCase()}`;

  if (!open || !target) return null;

  return createPortal(
    <div className="upm-overlay upm-overlay--center" onClick={onClose}>
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
  );
}
