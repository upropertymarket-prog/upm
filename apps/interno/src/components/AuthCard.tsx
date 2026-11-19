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
 * onde se estava. Passa a ter, à esquerda, o painel da equipa ("acesso
 * reservado"), à direita o formulário. Layout em `auth-card.css`. O nome fica
 * `AuthCard` para não mexer nos chamadores.
 *
 * O painel fecha com uma frase geral, e não com a lista das medidas de
 * segurança (2FA, PIN, auditoria): a página é pública, e dizer a quem chega
 * como a área se protege é dar-lhe o mapa (pedido do cliente, 14 nov 2026).
 */

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
      <div
        style={{
          paddingTop: "50px",
          paddingRight: "50px",
          paddingBottom: "24px",
          paddingLeft: "50px",
        }}
        className="upm-iauth__panel-inner"
      >
        <Brand />

        <div className="upm-iauth__intro">
          <span className="upm-iauth__eyebrow">{t("eyebrow")}</span>
          <p className="upm-iauth__headline">{t("headline")}</p>
        </div>

        <p style={{ paddingTop: "16px", paddingBottom: "0px" }} className="upm-iauth__closing">
          {t("closing")}
        </p>
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

        <div
          style={{
            paddingTop: "43px",
            paddingRight: "72px",
            paddingBottom: "50px",
            paddingLeft: "72px",
          }}
          className="upm-iauth__main"
        >
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
