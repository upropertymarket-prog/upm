import { useTranslations } from "next-intl";
import { Brand } from "@upm/ui";

import "./auth-card.css";

/**
 * A moldura dos ecrãs de entrada do interno (8 nov 2026)
 * =========================================================================
 * Entrar, "Esqueci-me", palavra-passe nova e os dois ecrãs da 2FA, sem o
 * cromado da área interna — quem lá está ainda não entrou. Estava repetida em
 * quatro `page.tsx`; saiu para aqui para as storyboards desenharem a mesma
 * moldura que a página, em vez de uma cópia.
 *
 * **14 nov 2026 — duas metades.** O cartão sozinho no meio do ecrã não dizia
 * onde se estava. Passa a ter, à esquerda, o painel da equipa: "acesso
 * reservado" e as três garantias que a área cumpre (2FA obrigatória, PIN nas
 * operações sensíveis, auditoria); à direita o formulário. Layout em
 * `auth-card.css`. O nome fica `AuthCard` para não mexer nos chamadores.
 */

const ICON_PROPS = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

/** Os ícones das garantias — decorativos, o texto diz tudo. */
const ICONS = {
  twoFactor: (
    <svg {...ICON_PROPS}>
      <path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  pin: (
    <svg {...ICON_PROPS}>
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <path d="M12 14v2" />
    </svg>
  ),
  audit: (
    <svg {...ICON_PROPS}>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5" />
      <path d="M10 13h6M10 17h4" />
    </svg>
  ),
};

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function StaffPanel() {
  const t = useTranslations("auth.staffShell");

  return (
    // Ilha em tema escuro: os tokens trocam sozinhos, seja a página clara ou escura.
    <aside className="upm-iauth__panel" data-theme="dark">
      <div className="upm-iauth__panel-inner">
        <Brand />

        <div className="upm-iauth__intro">
          <span className="upm-iauth__eyebrow">{t("eyebrow")}</span>
          <p className="upm-iauth__headline">{t("headline")}</p>
          <p className="upm-iauth__lead">{t("lead")}</p>
        </div>

        <ul className="upm-iauth__assurances">
          {(["twoFactor", "pin", "audit"] as const).map((id) => (
            <li key={id} className="upm-iauth__assurance">
              <span className="upm-iauth__assurance-icon">{ICONS[id]}</span>
              <span>
                <span className="upm-iauth__assurance-title">
                  {t(`assurances.${id}.title`)}
                </span>
                <span className="upm-iauth__assurance-text">{t(`assurances.${id}.text`)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

export function AuthCard({ children }: { children: React.ReactNode }) {
  const t = useTranslations("auth.staffShell");

  return (
    <main className="upm-iauth">
      <div className="upm-iauth__grid">
        <StaffPanel />

        <div className="upm-iauth__main">
          <p className="upm-iauth__top">
            <LockIcon />
            <span>{t("restricted")}</span>
          </p>

          <div className="upm-iauth__body">
            <div className="upm-iauth__form">{children}</div>
          </div>

          <footer className="upm-iauth__footer">
            <span>{t("copyright", { year: new Date().getFullYear() })}</span>
            <span className="upm-iauth__footer-note">{t("monitored")}</span>
          </footer>
        </div>
      </div>
    </main>
  );
}
