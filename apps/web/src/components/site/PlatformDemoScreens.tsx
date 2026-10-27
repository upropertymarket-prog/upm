"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AppShell, PageHeader, greetingKey, type NavGroup } from "@upm/ui";
import {
  DEMO_BUYER_NAV_ITEMS,
  DEMO_BUYER_NOTIFICATIONS,
  DEMO_BUYER_STORAGE,
  DEMO_BUYER_USER,
  DEMO_OWNER_LEADS,
  DEMO_OWNER_NAV_ITEMS,
  DEMO_OWNER_NOTIFICATIONS,
  DEMO_OWNER_PROPERTIES,
  DEMO_OWNER_STORAGE,
  DEMO_OWNER_USER,
  type DemoNavItem,
  type DemoSectionId,
} from "@upm/ui/demo-data";

import type { TabId } from "./PlatformDemo";
import { DemoCloud } from "./demo/DemoCloud";
import { DemoContracts } from "./demo/DemoContracts";
import { DemoDashboard } from "./demo/DemoDashboard";
import { DemoLeads } from "./demo/DemoLeads";
import { DemoMap } from "./demo/DemoMap";
import { DemoMarket, DemoSaved } from "./demo/DemoListings";
import { DemoMessages } from "./demo/DemoMessages";
import { DemoPlan } from "./demo/DemoPlan";
import { DemoProperties } from "./demo/DemoProperties";
import { DemoReports } from "./demo/DemoReports";
import { DemoSettings } from "./demo/DemoSettings";
import { DemoVisits } from "./demo/DemoVisits";
import { useDemoFormat } from "./demo/format";
import "./demo/demo.css";

/**
 * Os ecrãs da demonstração, num módulo à parte (P2-04)
 * =========================================================================
 * **Separados do `PlatformDemo` por causa do peso, não por arrumação.** Isto
 * arrasta o `AppShell` inteiro — sidebar, topbar, menus —, os catorze ecrãs e
 * as fixtures. Com tudo num ficheiro só, esse código entrava no chunk da home
 * e era descarregado e interpretado por toda a gente que abre o site,
 * incluindo quem nunca desce até à secção da plataforma. A home é precisamente
 * a página onde o AC de P2-06 mede Lighthouse ≥ 90.
 *
 * O `PlatformDemo` carrega este módulo com `next/dynamic` e `ssr: false`, e só
 * quando a secção se aproxima do ecrã. `ssr: false` porque não há nada aqui que
 * valha a pena ter no HTML servido: é uma demonstração com dados inventados,
 * não conteúdo que se queira indexado.
 *
 * ## O menu navega (27 out 2026)
 *
 * Até aqui os itens do menu eram `<a href="#">`. Um `#` **é** uma navegação:
 * o browser resolve-o para o início do documento e salta para lá — e o
 * documento, neste caso, é a home do site público. Clicasse-se onde se
 * clicasse na barra lateral, o visitante era atirado para o topo da página, o
 * contrário do que a secção promete ("navegue pelo painel real da
 * plataforma").
 *
 * A correção não foi tirar o salto: foi dar ao menu o que ele aparentava ter.
 * Cada item é hoje um `<button>` (pela via do `renderLink` da `Sidebar`) que
 * troca o ecrã **dentro da caixa**, e existem ecrãs para as catorze secções
 * dos dois menus. Nenhum deles toca na app autenticada — continua a valer 07
 * §7: "a rota `?demo=1` é eliminada; não vale o risco".
 *
 * Cada perfil guarda a secção onde ia: trocar de Proprietário para Comprador e
 * voltar não perde o lugar, como não perderia numa aplicação com duas sessões.
 */

/** O que o menu do perfil mostra e, logo, que ecrãs este painel pode abrir. */
const NAV: Record<TabId, DemoNavItem[]> = {
  owner: DEMO_OWNER_NAV_ITEMS,
  buyer: DEMO_BUYER_NAV_ITEMS,
};

/** Onde cada perfil começa — o que o produto abre depois do login. */
const FIRST: Record<TabId, DemoSectionId> = { owner: "dashboard", buyer: "market" };

/**
 * O cabeçalho de cada secção.
 *
 * Os títulos e os subtítulos são os do produto, lidos das mesmas chaves que os
 * ecrãs verdadeiros usam — é por isso que a demonstração está nos dois idiomas
 * sem ter uma única frase própria. Só os Contratos precisaram de um subtítulo
 * novo: a página de `/contratos` compõe o dela com uma contagem que esta
 * demonstração não tem por que inventar.
 */
function useHeader(role: TabId) {
  const t = useTranslations();
  const format = useDemoFormat();
  const owner = role === "owner";
  const user = owner ? DEMO_OWNER_USER : DEMO_BUYER_USER;
  const storage = owner ? DEMO_OWNER_STORAGE : DEMO_BUYER_STORAGE;

  return (section: DemoSectionId): { title: string; subtitle: string } => {
    switch (section) {
      case "dashboard":
        return {
          title: t(`greeting.${greetingKey()}`, { name: user.name.split(" ")[0]! }),
          subtitle: owner ? t("dashboard.ownerSubtitle") : t("dashboard.buyerSubtitle"),
        };
      case "market":
        return { title: t("nav.market"), subtitle: t("market.inYourArea") };
      case "myProperties":
        return {
          title: t("myProperties.title"),
          subtitle: t("myProperties.subtitle", { count: DEMO_OWNER_PROPERTIES.length }),
        };
      case "leads":
        return {
          title: t("nav.leads"),
          subtitle: t("leads.pageSubtitle", { count: DEMO_OWNER_LEADS.length }),
        };
      case "messages":
        return { title: t("nav.messages"), subtitle: t("messages.pageSubtitle") };
      case "visitSchedule":
        return { title: t("nav.visitSchedule"), subtitle: t("visits.pageSubtitleOwner") };
      case "myRequests":
        return {
          title: t("nav.myRequests"),
          subtitle: t("dashboard.quickAccess.visitRequests.body"),
        };
      case "saved":
        return { title: t("nav.saved"), subtitle: t("dashboard.quickAccess.saved.body") };
      case "map":
        return { title: t("nav.map"), subtitle: t("market.inYourArea") };
      case "cloud":
        return {
          title: t("cloud.title"),
          subtitle: t("cloud.subtitleUsed", {
            used: format.bytes(storage.usedBytes),
            limit: format.bytes(storage.limitBytes),
          }),
        };
      case "contracts":
        return { title: t("nav.contracts"), subtitle: t("site.demo.subtitle.contracts") };
      case "myReports":
        return { title: t("support.myReports.title"), subtitle: t("support.myReports.subtitle") };
      case "plan":
        return { title: t("plan.title"), subtitle: t("plan.subtitle") };
      case "settings":
        return { title: t("settings.title"), subtitle: t("settings.subtitle") };
      default: {
        // Exaustividade verificada pelo compilador: uma secção nova sem
        // cabeçalho não compila, em vez de aparecer sem título.
        const exhaustive: never = section;
        return exhaustive;
      }
    }
  };
}

/** O ecrã de cada secção. As que só um dos perfis tem nunca chegam ao outro. */
function Screen({
  section,
  role,
  onNavigate,
}: {
  section: DemoSectionId;
  role: TabId;
  onNavigate: (id: DemoSectionId) => void;
}) {
  switch (section) {
    case "dashboard":
      return <DemoDashboard role={role} onNavigate={onNavigate} />;
    case "market":
      return <DemoMarket />;
    case "myProperties":
      return <DemoProperties />;
    case "leads":
      return <DemoLeads />;
    case "messages":
      return <DemoMessages role={role} />;
    case "visitSchedule":
    case "myRequests":
      return <DemoVisits role={role} />;
    case "saved":
      return <DemoSaved />;
    case "map":
      return <DemoMap />;
    case "cloud":
      return <DemoCloud role={role} />;
    case "contracts":
      return <DemoContracts role={role} />;
    case "myReports":
      return <DemoReports />;
    case "plan":
      return <DemoPlan role={role} />;
    case "settings":
      return <DemoSettings role={role} />;
    default: {
      const exhaustive: never = section;
      return exhaustive;
    }
  }
}

function DemoPanel({ role, hidden }: { role: TabId; hidden: boolean }) {
  const t = useTranslations();
  const tNav = useTranslations("nav");
  const tSidebar = useTranslations("sidebar");
  const tTopbar = useTranslations("topbar");
  const tTheme = useTranslations("theme");
  const tDemo = useTranslations("site.demo.notifications");
  const locale = useLocale();
  const format = useDemoFormat();

  const [section, setSection] = useState<DemoSectionId>(FIRST[role]);
  const scroller = useRef<HTMLDivElement>(null);
  const header = useHeader(role)(section);

  const owner = role === "owner";
  const user = owner ? DEMO_OWNER_USER : DEMO_BUYER_USER;
  const notifications = owner ? DEMO_OWNER_NOTIFICATIONS : DEMO_BUYER_NOTIFICATIONS;

  /**
   * Trocar de secção volta ao topo **da caixa**.
   *
   * Sem isto, quem estivesse a ver o fim da tabela de leads e clicasse em
   * "Plano" aterrava a meio do ecrã novo — e era precisamente de um salto de
   * scroll que vinha o defeito que isto corrige. O que nunca se toca é o
   * scroll da página: a home fica onde está.
   */
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [section]);

  const groups: NavGroup[] = [
    {
      label: tSidebar(owner ? "groups.manage" : "groups.search"),
      items: NAV[role].map((item) => ({
        id: item.id,
        label: tNav(item.id),
        href: item.href,
        icon: item.icon,
        count: item.count,
      })),
    },
  ];

  return (
    <div
      ref={scroller}
      role="tabpanel"
      id={`demo-panel-${role}`}
      aria-labelledby={`demo-tab-${role}`}
      hidden={hidden}
      style={{ height: "100%", overflow: "auto" }}
    >
      <AppShell
        // `.upm-shell` traz `min-height: 100vh` e aqui vive numa caixa, não
        // numa janela. `100%` e **nunca** uma altura em pixels — o aviso no
        // próprio `AppShell` diz o que isso parte. A nota completa, com a
        // segunda armadilha (a sidebar `fixed`), está em `PlatformDemo.tsx`.
        style={{ minHeight: "100%" }}
        // O Mapa é a exceção de 04 §1.5: ali o conteúdo é a área visível.
        contentWidth={section === "map" ? "full" : "default"}
        sidebar={{
          groups,
          activeId: section,
          user: {
            name: user.name,
            meta: `${t(`roles.${role}`)} · ${user.planName}`,
            initials: user.initials,
            online: true,
          },
          onReport: () => undefined,
          onSignOut: () => undefined,
          labels: {
            collapse: tSidebar("collapse"),
            expand: tSidebar("expand"),
            report: tSidebar("report"),
            signOut: tSidebar("signOut"),
            countSuffix: tSidebar("countSuffix"),
          },
          /**
           * É aqui que a demonstração navega. Um `<button>` com a classe do
           * item de menu: `.upm-nav__item` já nasceu sem borda, sem fundo e com
           * `text-align: left`, por isso desenha-se igual a um `<a>` — e um
           * botão não tem destino nenhum para onde saltar.
           */
          renderLink: ({ id, className, children, title, ...rest }) => (
            <button
              type="button"
              className={className}
              title={title}
              aria-current={rest["aria-current"]}
              onClick={() => setSection(id as DemoSectionId)}
            >
              {children}
            </button>
          ),
        }}
        topbar={{
          labels: {
            search: tTopbar("search"),
            openMenu: tTopbar("openMenu"),
            language: t("locale.title"),
            notifications: tTopbar("notifications"),
            markAllRead: tTopbar("markAllRead"),
            noNotifications: tTopbar("noNotifications"),
            theme: {
              title: tTheme("title"),
              light: tTheme("light"),
              dark: tTheme("dark"),
              system: tTheme("system"),
            },
          },
          /* Mostra o idioma do site e não troca nada: a demonstração fala a
             língua em que o visitante está a ler o site, e um segundo seletor
             de idioma aqui dentro era uma preferência a competir com essa. */
          locale,
          locales: [
            { value: "pt", label: t("locale.pt") },
            { value: "en", label: t("locale.en") },
          ],
          onLocaleChange: () => undefined,
          notifications: notifications.map((item) => ({
            id: item.id,
            text: tDemo(item.textKey, item.textParams),
            when: format.ago(item.minutesAgo),
            read: item.read,
          })),
          onMarkAllRead: () => undefined,
        }}
      >
        <div className="upm-demo-screen" style={{ display: "grid", gap: "var(--sp-6)" }}>
          <PageHeader title={header.title} subtitle={header.subtitle} />
          <Screen section={section} role={role} onNavigate={setSection} />
        </div>
      </AppShell>
    </div>
  );
}

/**
 * O que o `PlatformDemo` monta: os dois painéis, ambos presentes.
 *
 * 07 §7 pede-os "pré-carregados para não haver ecrã branco na troca", e é por
 * isso que o painel inativo é escondido com `hidden` em vez de deixar de ser
 * renderizado — e também o que faz cada perfil guardar a secção onde ia.
 */
export default function PlatformDemoScreens({ active }: { active: TabId }) {
  return (
    <>
      <DemoPanel role="owner" hidden={active !== "owner"} />
      <DemoPanel role="buyer" hidden={active !== "buyer"} />
    </>
  );
}
