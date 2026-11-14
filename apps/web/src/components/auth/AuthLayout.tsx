import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import type { StaticSitePathname } from "@/i18n/routing";
import { Brand } from "@upm/ui";

import "./auth.css";

/**
 * Invólucro dos ecrãs de autenticação (Fase 3 · 03 F2, F3)
 * =========================================================================
 * As páginas de auth — entrar, criar conta, verificação, pedir recuperação e
 * definir nova palavra-passe — partilham esta moldura, e o canvas importa este
 * mesmo componente: uma cópia dentro do canvas fazia as storyboards mostrar
 * uma reconstrução em vez da página real.
 *
 * **7 out 2026.** O cliente: *"páginas que só contêm um form, sem nada mais, é
 * estranho"*. Entraram a marca, o título, a troca entre entrar e criar conta e
 * o rodapé legal.
 *
 * **14 nov 2026 — duas metades.** Logótipo e formulário continuavam a ser
 * pouco: a página não aproveitava a mensagem do site. À esquerda passa a
 * estar o painel da marca — fundo azul-marinho, "Compre e venda. Sem
 * comissões." e os três números —, à direita o formulário, sem cartão. O
 * painel é igual em todas as páginas: é a marca, não o ecrã.
 * Layout em `auth.css`.
 */

/** Larguras da coluna do formulário, as mesmas dos antigos cartões. */
const WIDTHS = {
  sm: "24rem",
  md: "28rem",
  lg: "32rem",
  // Para um documento, não para um formulário: o contrato de adesão tem tabelas
  // de duas colunas e `lg` partia cada valor em três linhas. É a largura das
  // páginas legais (`LegalDocumentView`) — o mesmo tipo de texto.
  xl: "48rem",
} as const;

export type AuthCardWidth = keyof typeof WIDTHS;

export type AuthShellProps = {
  width?: AuthCardWidth;
  /** Título do ecrã. Omitido quando o próprio formulário já o desenha. */
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** A troca no topo do formulário: "Ainda não tem conta? Criar conta". */
  switchPrompt?: React.ReactNode;
  /**
   * Uma rota conhecida, não uma string qualquer. O tipo é o do `next-intl`
   * desde 20 out 2026: com o segmento `[locale]`, o `Route` do Next passou a
   * ser `/[locale]/entrar` e deixou de casar com os caminhos sem prefixo que
   * este site escreve. A lista está em `i18n/routing.ts`.
   */
  switchHref?: StaticSitePathname;
  switchLabel?: React.ReactNode;
  /** Texto do link para os Termos no rodapé. */
  legalLabel: React.ReactNode;
  /** Política de Privacidade — opcional só porque nem todos os ecrãs a passam. */
  privacyLabel?: React.ReactNode;
  /** Política de Cookies — idem. */
  cookiesLabel?: React.ReactNode;
  children: React.ReactNode;
};

/** A seta do link de troca — decorativa, o texto já diz para onde vai. */
function ArrowUpRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M5 11 11 5M6 5h5v5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** O painel da marca: igual em todas as páginas de autenticação. */
function AuthBrandPanel() {
  const t = useTranslations("auth.shell.pitch");

  return (
    // Ilha em tema escuro: os tokens (texto, acento, logótipo) trocam sozinhos,
    // seja a página clara ou escura.
    <aside className="upm-auth__brand" data-theme="dark">
      <div className="upm-auth__brand-inner">
        {/* O wordmark leva ao site público: é a saída de quem chegou aqui por
            engano. `Brand` é o componente do design system (07 §10.1). */}
        <Link href="/" aria-label="UProperty Market" style={{ alignSelf: "flex-start" }}>
          <Brand />
        </Link>

        <div className="upm-auth__pitch">
          <span className="upm-auth__eyebrow">{t("eyebrow")}</span>
          <p className="upm-auth__headline">
            {t("headline")}
            <span className="upm-auth__headline-accent">{t("headlineAccent")}</span>
          </p>
          <p className="upm-auth__lead">{t("lead")}</p>
        </div>

        <ul className="upm-auth__stats">
          {(["commission", "privacy", "direct"] as const).map((id) => (
            <li key={id} className="upm-auth__stat">
              <span className="upm-auth__stat-value">{t(`stats.${id}.value`)}</span>
              <span className="upm-auth__stat-label">{t(`stats.${id}.label`)}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

/**
 * A página de autenticação completa: painel da marca, troca, formulário e
 * rodapé.
 *
 * O rodapé liga **só ao que existe**. A Política de Proteção de Dados continua
 * de fora: é P11-07 e ainda não existe, e um link morto é pior do que nenhum.
 */
export function AuthShell({
  width = "sm",
  title,
  subtitle,
  switchPrompt,
  switchHref,
  switchLabel,
  legalLabel,
  privacyLabel,
  cookiesLabel,
  children,
}: AuthShellProps) {
  const t = useTranslations("auth.shell");

  return (
    <main className="upm-auth">
      <div className="upm-auth__grid">
        <AuthBrandPanel />

        <div className="upm-auth__main">
          {switchPrompt && switchHref && switchLabel ? (
            <p className="upm-auth__top" style={{ margin: 0, justifyContent: "space-between" }}>
              <span>{switchPrompt}</span>
              <Link href={switchHref} className="upm-auth__switch">
                {switchLabel}
                <ArrowUpRight />
              </Link>
            </p>
          ) : null}

          <div className="upm-auth__body">
            <div className="upm-auth__form" style={{ maxWidth: WIDTHS[width] }}>
              {title || subtitle ? (
                <div className="upm-auth__heading">
                  {title ? <h1 className="upm-auth__title">{title}</h1> : null}
                  {subtitle ? <p className="upm-auth__subtitle">{subtitle}</p> : null}
                </div>
              ) : null}
              {children}
            </div>
          </div>

          {/* Separadores como elementos próprios, e não `·` no texto, para o
              leitor de ecrã anunciar três links e não uma frase só. */}
          <footer className="upm-auth__footer">
            <span>{t("copyright", { year: new Date().getFullYear() })}</span>
            <nav className="upm-auth__legal" aria-label={t("legalNav")}>
              <Link href="/termos">{legalLabel}</Link>
              {privacyLabel ? <Link href="/privacidade">{privacyLabel}</Link> : null}
              {cookiesLabel ? <Link href="/cookies">{cookiesLabel}</Link> : null}
            </nav>
          </footer>
        </div>
      </div>
    </main>
  );
}
