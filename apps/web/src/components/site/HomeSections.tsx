"use client";

import { useState, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Tabs } from "@upm/ui";

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
import type { LeadFormState } from "@/lib/leadFormState";
import type { PublicListingCard } from "../../lib/public-listings";
import { SiteImage } from "./SiteImage";
import {
  AUDIENCE_CARDS,
  AUDIENCE_IDS,
  COMING_SOON_CARDS,
  MISSION_VALUE_CARDS,
  SITE_IMAGES,
  type AudienceId,
} from "../../lib/site-content";

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
  /**
   * Só o canvas o passa, e passa um no-op: ver a nota do `PublicHeader`. Numa
   * página do site não se passa — o cabeçalho troca de idioma navegando.
   */
  onLocaleChange?: (locale: string) => void | Promise<void>;
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
  const t = useTranslations("site");
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
          {/* `--sp-9` (24 px) e não `--sp-6`: mais ar entre o texto e os
              botões de perfil da demo (cliente, 11 nov 2026). */}
          <div style={{ display: "grid", gap: "var(--sp-9)", rowGap: "20px" }}>
            <SectionHeading
              eyebrow={t("platform.eyebrow")}
              title={t("platform.title")}
              body={t("platform.body")}
            />
            {/* A demonstração interativa (P2-04). Ocupou o lugar que estava
                reservado aqui com uma caixa 16/10 vazia desde P2-01. Os ecrãs
                são os componentes reais da plataforma com fixtures estáticas —
                a razão de não serem as rotas autenticadas está em 07 §7 e
                repetida no cabeçalho do `PlatformDemo`. */}
            <PlatformDemo />
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Link href={signupHref} className="upm-btn upm-btn--secondary upm-btn--md">
                {t(`platformCta.${launchMode}`)}
              </Link>
            </div>
          </div>
        </SiteSection>

        {/* "Sobre nós" e "A nossa missão" na mesma secção (6 nov 2026, como no
            site de pré-lançamento anterior): a primeira diz o que é a
            plataforma, a segunda porquê, e os três valores fecham-na. Texto e
            fotografia alternam de lado, que é o que dá ritmo à página. */}
        <SiteSection id="sobre">
          <div style={{ display: "grid", gap: "clamp(3rem, 8vw, 6rem)" }}>
            <Split
              image={
                <SiteImage
                  image={SITE_IMAGES.about}
                  label={t("about.imageLabel")}
                  aspectRatio="4 / 3"
                />
              }
            >
              <SectionHeading
                eyebrow={t("about.eyebrow")}
                title={t("about.title")}
                body={t("about.body")}
              />
              <div>
                <Link href={signupHref} className="upm-btn upm-btn--primary upm-btn--md">
                  {t(`platformCta.${launchMode}`)}
                </Link>
              </div>
            </Split>

            <Split
              imageFirst
              image={
                <SiteImage
                  image={SITE_IMAGES.mission}
                  label={t("mission.imageLabel")}
                  aspectRatio="4 / 3"
                />
              }
            >
              <SectionHeading
                eyebrow={t("mission.eyebrow")}
                title={t("mission.title")}
                body={t("mission.body")}
              />
              <p style={{ margin: 0, fontSize: "16px", lineHeight: 1.6, color: "var(--muted)" }}>
                {t("mission.bodyCommitment")}
              </p>
            </Split>

            <FeatureGrid
              cards={MISSION_VALUE_CARDS.map((card) => ({
                icon: card.icon,
                title: t(`about.points.${card.id}.title`),
                body: t(`about.points.${card.id}.body`),
              }))}
              minColumn="15rem"
            />
          </div>
        </SiteSection>

        <SiteSection id="empresas" tone="alt">
          <Split
            image={
              <SiteImage
                image={SITE_IMAGES.business}
                label={t("business.imageLabel")}
                aspectRatio="4 / 3"
              />
            }
          >
            <SectionHeading
              eyebrow={t("business.eyebrow")}
              title={t("business.title")}
              body={t("business.body")}
            />
            <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
              <Link href={signupHref} className="upm-btn upm-btn--primary upm-btn--md">
                {t("business.primaryCta")}
              </Link>
              <a href="#contactos" className="upm-btn upm-btn--secondary upm-btn--md">
                {t("business.secondaryCta")}
              </a>
            </div>
          </Split>
        </SiteSection>

        {/* "Em breve" em pré-lançamento, "Propriedades mais recentes" depois — a
            troca que 04 §2.1 pede. Em pós-lançamento sem nada publicado o
            `RecentListings` devolve `null` e a secção desaparece: uma grelha
            vazia sob o título diria que o site está partido. */}
        {launchMode === "post" ? (
          <SiteSection id="propriedades-recentes">
            <RecentListings listings={recentListings} />
          </SiteSection>
        ) : null}

        {launchMode === "pre" ? (
          <SiteSection>
            {/* `--site-gap` (40 px) entre o texto e os cartões, como nas outras
                secções desde 8 nov 2026: com 14 px o texto colava-se à grelha. */}
            <div style={{ display: "grid", gap: "var(--site-gap)" }}>
              <SectionHeading
                eyebrow={t("comingSoon.eyebrow")}
                title={t("comingSoon.title")}
                body={t("comingSoon.body")}
                align="center"
              />
              <FeatureGrid
                cards={COMING_SOON_CARDS.map((card) => ({
                  icon: card.icon,
                  title: t(`comingSoon.cards.${card.id}.title`),
                  body: t(`comingSoon.cards.${card.id}.body`),
                }))}
                minColumn="14rem"
              />
              <div
                style={{
                  display: "flex",
                  gap: "var(--sp-3)",
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                <Link href="/pre-inscricao" className="upm-btn upm-btn--primary upm-btn--md">
                  {t("comingSoon.primaryCta")}
                </Link>
                <a href="#plataforma" className="upm-btn upm-btn--secondary upm-btn--md">
                  {t("comingSoon.secondaryCta")}
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
            ctaLabel={t(`pricingCta.${launchMode}`)}
          />
        </SiteSection>

        <SiteSection>
          <Banner text={t("banner.text")} label={t("banner.imageLabel")} />
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
            {/* Título em duas linhas ("Tem dúvidas?" / "Fale connosco.") e o
                texto com uma largura parecida (cliente, 11 nov 2026). */}
            <SectionHeading
              title={t("contact.title")}
              body={t("contact.body")}
              bodyMaxWidth="20rem"
            />
            <ContactForm onSubmit={onContact} />
          </div>
        </SiteSection>
      </main>

      <SiteFooter launchMode={launchMode} />
    </>
  );
}

/**
 * Texto de um lado, fotografia do outro; em ecrã estreito, uma por baixo da
 * outra, com o texto sempre primeiro (a ordem do DOM é a da leitura, e o
 * `imageFirst` só troca o lado visual, pela `order` da grelha).
 */
function Split({
  image,
  imageFirst = false,
  children,
}: {
  image: ReactNode;
  imageFirst?: boolean;
  children: ReactNode;
}) {
  // As classes estão em `site.css`: o corte para duas colunas mede a secção
  // (container query), e o texto fica com a sua medida de leitura.
  return (
    <div
      className={imageFirst ? "upm-site-split upm-site-split--image-first" : "upm-site-split"}
      style={{ rowGap: "24px" }}
    >
      <div className="upm-site-split__text" style={{ rowGap: "16px" }}>
        {children}
      </div>
      <div className="upm-site-split__media">{image}</div>
    </div>
  );
}

/**
 * A faixa "Mais do que uma plataforma…" (6 nov 2026, do site anterior): uma
 * fotografia em largura total com a frase por cima. O véu escuro está lá
 * sempre — é ele que garante o contraste do texto branco, seja qual for a
 * fotografia que entrar.
 */
function Banner({ text, label }: { text: string; label: string }) {
  return (
    <div
      style={{
        position: "relative",
        display: "grid",
        minHeight: "clamp(16rem, 38vw, 26rem)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
      }}
    >
      <SiteImage image={SITE_IMAGES.banner} label={label} rounded={false} showLabel={false} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          padding: "var(--sp-6)",
          // Preto fixo e não um token: o véu tem de escurecer a fotografia
          // nos dois temas, e o texto por cima é branco nos dois.
          background: "rgba(0, 0, 0, 0.45)",
        }}
      >
        <p
          style={{
            margin: 0,
            maxWidth: "32rem",
            textAlign: "center",
            fontFamily: "var(--font-display)",
            fontSize: "clamp(1.4rem, 3.4vw, 2.25rem)",
            // Semibold e não o 700 dos títulos (pedido do cliente, 8 nov 2026):
            // a frase é uma pausa entre secções, não um título.
            fontWeight: "var(--fw-semibold)",
            lineHeight: 1.2,
            color: "#fff",
          }}
        >
          {text}
        </p>
      </div>
      {SITE_IMAGES.banner ? null : (
        <span
          style={{
            position: "absolute",
            right: "var(--sp-4)",
            bottom: "var(--sp-3)",
            fontSize: "var(--fs-label)",
            color: "rgba(255, 255, 255, 0.7)",
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

/**
 * As duas audiências de 04 §2.1, num seletor (6 nov 2026): o site já fala às
 * empresas na secção própria, por isso os cartões delas também entram. O
 * texto dos cartões das Empresas é provisório até o cliente rever os do site
 * anterior.
 */
function Audiences() {
  const t = useTranslations("site.audiences");
  const [audience, setAudience] = useState<AudienceId>("particulares");

  return (
    // `--site-gap` (40 px) entre o título e os cartões: com os 14 px de antes
    // o título colava-se à grelha (pedido do cliente, 8 nov 2026).
    <div style={{ display: "grid", gap: "var(--site-gap)", justifyItems: "center" }}>
      <Tabs
        label={t(`${audience}.title`)}
        value={audience}
        onValueChange={(id) => setAudience(id as AudienceId)}
        items={AUDIENCE_IDS.map((id) => ({ id, label: t(`tabs.${id}`) }))}
      />
      <SectionHeading title={t(`${audience}.title`)} align="center" />
      <div style={{ width: "100%" }}>
        <FeatureGrid
          cards={AUDIENCE_CARDS[audience].map((card) => ({
            icon: card.icon,
            title: t(`${audience}.cards.${card.id}.title`),
            body: t(`${audience}.cards.${card.id}.body`),
          }))}
          maxColumns={3}
        />
      </div>
    </div>
  );
}
