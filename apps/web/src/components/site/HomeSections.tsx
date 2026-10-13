"use client";

import Link from "next/link";

import { PublicHeader } from "../PublicHeader";
import { ContactForm } from "./ContactForm";
import { Faq } from "./Faq";
import { FeatureGrid } from "./FeatureGrid";
import { Hero } from "./Hero";
import { PlatformDemo } from "./PlatformDemo";
import { Pricing, type PublicPlan } from "./Pricing";
import { RecentListings } from "./RecentListings";
import { SectionHeading, SiteSection } from "./SiteSection";
import { SiteFooter } from "./SiteFooter";
import type { LeadFormState } from "../../app/pre-inscricao/leadFormState";
import type { PublicListingCard } from "../../lib/public-listings";
import { ABOUT, AUDIENCES, BUSINESS, COMING_SOON, CONTACT, PLATFORM } from "../../lib/site-content";

/**
 * A home inteira, sem ir buscar nada (P2-01)
 * =========================================================================
 * Separado de `page.tsx` a 7 out 2026 para a home poder ser **vista no
 * canvas**. O Server Component lê `launch_mode` e o catálogo de planos da base
 * de dados, e nada disso corre dentro de uma storyboard — o canvas precisava
 * de um componente que receba o estado em vez de o descobrir.
 *
 * O corte é o certo por si só, canvas à parte: a página passa a ter uma camada
 * que busca dados e outra que os desenha, e a segunda pode ser vista nos dois
 * modos lado a lado sem tocar na base de dados.
 *
 * **Tudo o que varia entra por prop.** Se um dia aparecer aqui um `await` ou
 * um `cookies()`, o canvas deixa de a conseguir renderizar e volta-se ao ponto
 * de partida.
 */
export type HomeSectionsProps = {
  launchMode: "pre" | "post";
  plans: PublicPlan[];
  locale: string;
  /** Server Action na app; no canvas, um no-op. */
  onLocaleChange: (locale: string) => void | Promise<void>;
  /** `submitContact` de `pre-inscricao/actions.ts`; no canvas, um no-op. */
  onContact: (previous: LeadFormState, formData: FormData) => Promise<LeadFormState>;
  /**
   * Os seis últimos publicados (P2-05). Só se usa em `post`; em `pre` chega
   * vazia e nunca se lê. Entra por prop como tudo o resto — se esta lista
   * fosse buscada aqui dentro, a home voltava a ser irrenderizável no canvas.
   */
  recentListings?: PublicListingCard[];
};

export function HomeSections({
  launchMode,
  plans,
  locale,
  onLocaleChange,
  onContact,
  recentListings = [],
}: HomeSectionsProps) {
  const signupHref = launchMode === "pre" ? "/pre-inscricao" : "/criar-conta";

  return (
    <>
      <PublicHeader
        locale={locale}
        onLocaleChange={onLocaleChange}
        launchMode={launchMode}
        anchors="same-page"
      />

      <main>
        <Hero launchMode={launchMode} />

        <SiteSection id="plataforma" tone="alt">
          <div style={{ display: "grid", gap: "var(--sp-6)" }}>
            <SectionHeading
              eyebrow={PLATFORM.eyebrow}
              title={PLATFORM.title}
              body={PLATFORM.body}
            />
            {/* A demonstração interativa (P2-04). Ocupou o lugar que estava
                reservado aqui com uma caixa 16/10 vazia desde P2-01. Os ecrãs
                são os componentes reais da plataforma com fixtures estáticas —
                a razão de não serem as rotas autenticadas está em 07 §7 e
                repetida no cabeçalho do `PlatformDemo`. */}
            <PlatformDemo />
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Link href={signupHref} className="upm-btn upm-btn--secondary upm-btn--md">
                {launchMode === "pre" ? "Fazer pré-inscrição" : "Criar conta"}
              </Link>
            </div>
          </div>
        </SiteSection>

        <SiteSection id="sobre">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(20rem, 100%), 1fr))",
              gap: "clamp(1.5rem, 4vw, 3rem)",
              alignItems: "center",
            }}
          >
            {/* Imagem à esquerda, como 04 §2.1 pede para esta secção. */}
            <div
              role="img"
              aria-label={ABOUT.imageLabel}
              style={{
                aspectRatio: "4 / 3",
                borderRadius: "var(--r-lg)",
                border: "1px solid var(--border)",
                background: "var(--surface2)",
                display: "grid",
                placeItems: "center",
                color: "var(--muted)",
                fontSize: "var(--fs-body)",
              }}
            >
              {ABOUT.imageLabel}
            </div>
            <div style={{ display: "grid", gap: "var(--sp-5)" }}>
              <SectionHeading eyebrow={ABOUT.eyebrow} title={ABOUT.title} body={ABOUT.body} />
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "grid",
                  gap: "var(--sp-4)",
                }}
              >
                {ABOUT.points.map((point) => (
                  <li key={point.title} style={{ display: "grid", gap: "2px" }}>
                    <strong style={{ fontSize: "14.5px", color: "var(--text)" }}>
                      {point.title}
                    </strong>
                    <span style={{ fontSize: "14px", color: "var(--muted)" }}>{point.body}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </SiteSection>

        <SiteSection id="empresas" tone="alt">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(20rem, 100%), 1fr))",
              gap: "clamp(1.5rem, 4vw, 3rem)",
              alignItems: "center",
            }}
          >
            {/* Texto à esquerda nesta, ao contrário de "Sobre nós" — é o
                alternado do protótipo, e é o que dá ritmo à página. */}
            <div style={{ display: "grid", gap: "var(--sp-5)" }}>
              <SectionHeading
                eyebrow={BUSINESS.eyebrow}
                title={BUSINESS.title}
                body={BUSINESS.body}
              />
              <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
                <Link href={signupHref} className="upm-btn upm-btn--primary upm-btn--md">
                  {BUSINESS.primaryCta}
                </Link>
                <a href="#contactos" className="upm-btn upm-btn--secondary upm-btn--md">
                  {BUSINESS.secondaryCta}
                </a>
              </div>
            </div>
            <div
              role="img"
              aria-label={BUSINESS.imageLabel}
              style={{
                aspectRatio: "4 / 3",
                borderRadius: "var(--r-lg)",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                display: "grid",
                placeItems: "center",
                color: "var(--muted)",
                fontSize: "var(--fs-body)",
              }}
            >
              {BUSINESS.imageLabel}
            </div>
          </div>
        </SiteSection>

        {/* "Em breve" em pré-lançamento, "Propriedades mais recentes" depois — a
            troca que 04 §2.1 pede. Em pós-lançamento sem nada publicado o
            `RecentListings` devolve `null` e a secção desaparece: uma grelha
            vazia sob o título diria que o site está partido. */}
        {launchMode === "post" ? (
          <SiteSection id="imoveis-recentes">
            <RecentListings listings={recentListings} />
          </SiteSection>
        ) : null}

        {launchMode === "pre" ? (
          <SiteSection>
            <div style={{ display: "grid", gap: "var(--sp-6)" }}>
              <SectionHeading
                eyebrow={COMING_SOON.eyebrow}
                title={COMING_SOON.title}
                body={COMING_SOON.body}
                align="center"
              />
              <FeatureGrid cards={COMING_SOON.cards} minColumn="14rem" />
              <div
                style={{
                  display: "flex",
                  gap: "var(--sp-3)",
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                <Link href="/pre-inscricao" className="upm-btn upm-btn--primary upm-btn--md">
                  {COMING_SOON.primaryCta}
                </Link>
                <a href="#plataforma" className="upm-btn upm-btn--secondary upm-btn--md">
                  {COMING_SOON.secondaryCta}
                </a>
              </div>
            </div>
          </SiteSection>
        ) : null}

        <SiteSection tone="alt">
          <Audiences />
        </SiteSection>

        <SiteSection id="precos">
          <Pricing
            plans={plans}
            locale={locale}
            ctaHref={signupHref}
            ctaLabel={launchMode === "pre" ? "Pré-inscrever" : "Escolher plano"}
          />
        </SiteSection>

        <SiteSection id="duvidas" tone="alt">
          <Faq />
        </SiteSection>

        <SiteSection id="contactos">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(20rem, 100%), 1fr))",
              gap: "clamp(1.5rem, 4vw, 3rem)",
              alignItems: "start",
            }}
          >
            <SectionHeading title={CONTACT.title} body={CONTACT.body} />
            <ContactForm onSubmit={onContact} />
          </div>
        </SiteSection>
      </main>

      <SiteFooter />
    </>
  );
}

/** As duas audiências de 04 §2.1. Por agora só Particulares tem conteúdo
 *  aprovado no protótipo; Empresas entra quando o texto for validado. */
function Audiences() {
  return (
    <div style={{ display: "grid", gap: "var(--sp-6)" }}>
      <SectionHeading title={AUDIENCES.particulares.title} align="center" />
      <FeatureGrid cards={AUDIENCES.particulares.cards} />
    </div>
  );
}
