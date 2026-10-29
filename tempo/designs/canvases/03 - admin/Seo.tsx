import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import { ToastProvider } from "../../../../packages/ui/src/components/Toast";
import { InternalChrome } from "../../../../apps/interno/src/components/InternalChrome";
import "../../_estilos/shell-no-canvas.css";
import ptMessages from "../../../../packages/config/messages/pt.json";
import { SeoManager, type SeoPageRow } from "../../../../apps/interno/src/app/admin/seo/SeoManager";
import { SEO_ROUTES } from "../../../../packages/config/seo-routes.generated";

/**
 * Gestor de SEO — `/admin/seo` (P2-06 · 07, decisão de 7 out 2026)
 * =========================================================================
 * **É o componente real, não uma reprodução.** 07 decidiu, depois de o agente
 * verificar o repositório, que a "storyboard SEO Manager" de 04 §2.1.1 não
 * seria "um editor próprio ligado à mesma tabela e às mesmas server actions" —
 * isso seria um segundo editor de SEO a manter, que divergiria do produto à
 * primeira alteração. É `SeoManager.tsx` do Admin, com dados de demonstração.
 *
 * **Nenhuma storyboard escreve na base de dados**, e é a parte que não se pode
 * relaxar: `onSave` devolve `{}` e não chega a lado nenhum. Uma storyboard que
 * gravasse em `seo_pages` a partir do canvas seria um segundo caminho de
 * escrita para a mesma tabela, **sem o `is_admin()` do ecrã real**. A escrita
 * vive só em `/admin/seo`, com a RLS de 05 §1.9.
 *
 * As linhas saem de `SEO_ROUTES`, o inventário gerado dos `seo.ts` — as mesmas
 * rotas que o ecrã verdadeiro lista. Algumas levam sobreposição inventada, para
 * a coluna de estado mostrar os três casos que 07 obriga a distinguir: *usa
 * predefinições*, *completo* e *incompleto*. Com todas as linhas no mesmo
 * estado, a coluna que mais importa neste ecrã não se revia.
 *
 * ---------------------------------------------------------------------------
 * DOIS IDIOMAS (21 out 2026 · D72 fase C)
 * ---------------------------------------------------------------------------
 * `SeoPageRow` passou a ter um estado por idioma, e os dados daqui acompanham.
 * **O caso que esta storyboard existe para mostrar é o misto**: uma rota
 * corrigida em português e a usar o ficheiro em inglês. É a diferença que a
 * coluna de estado passou a poder dizer, e com os dois idiomas no mesmo estado
 * não se via nada de novo em relação a ontem.
 *
 * Os dados de demonstração usavam `/imoveis`, que deixou de existir a 20 out
 * quando o catálogo passou a `/propriedades`: as sobreposições dessa rota nunca
 * apareciam na lista. Ninguém reparou porque o `gate:canvas` estava cego — ver
 * a nota em `scripts/gate/check-canvas.mjs`.
 */

const EMPTY_OVERRIDE = {
  ogSameAsPage: true,
  ogTitle: "",
  ogDescription: "",
  ogImage: "",
  ogImageAlt: "",
  canonical: "",
  noindex: false,
};

type Override = NonNullable<SeoPageRow["locales"]["pt"]["override"]>;

/**
 * Sobreposições de demonstração, por rota **e idioma**. O resto fica em "usa
 * predefinições".
 */
const OVERRIDES: Record<string, Partial<Record<"pt" | "en", Override>>> = {
  // Corrigida nas duas línguas: o estado que se espera de uma home cuidada.
  "/": {
    pt: {
      ...EMPTY_OVERRIDE,
      titleTag: "Propriedades sem comissões em Portugal · UProperty Market",
      metaDescription:
        "Compre e venda diretamente com o proprietário, sem comissões e sem contactos indesejados. Veja as propriedades disponíveis.",
    },
    en: {
      ...EMPTY_OVERRIDE,
      titleTag: "Commission-free property in Portugal · UProperty Market",
      metaDescription:
        "Buy and sell directly with the owner — no commissions, no unwanted calls. See what is available today.",
    },
  },
  // O caso misto, e o mais importante desta lista: corrigida em português,
  // a usar o ficheiro em inglês. Antes da fase C isto era impossível de
  // representar, porque uma sobreposição valia para as duas línguas.
  "/propriedades": {
    pt: {
      ...EMPTY_OVERRIDE,
      titleTag: "Propriedades à venda e para arrendar · UProperty Market",
      // Incompleta de propósito: tem título e não tem descrição, que é o caso
      // que o aviso de "incompleto" existe para apanhar.
      metaDescription: "",
    },
  },
  "/pre-inscricao": {
    pt: {
      ...EMPTY_OVERRIDE,
      titleTag: "Pré-inscrição · UProperty Market",
      metaDescription:
        "Inscreva-se para ser avisado quando as primeiras propriedades abrirem, e garanta os valores de lançamento.",
    },
  },
};

/**
 * Última alteração, por rota e idioma — os três casos que a coluna tem de
 * distinguir.
 *
 * As rotas personalizadas trazem data e autor. `/termos` não tem sobreposição
 * e **tem** rasto: é a página que alguém devolveu ao ficheiro, o caso que se
 * perderia se a coluna lesse só a tabela. O resto nunca passou pelo painel e
 * mostra "nunca editada aqui".
 */
const LAST_CHANGES: Record<
  string,
  Partial<Record<"pt" | "en", SeoPageRow["locales"]["pt"]["lastChange"]>>
> = {
  "/": {
    pt: { at: "2026-10-12T09:30:00.000Z", by: "Helena Matos" },
    en: { at: "2026-10-20T14:10:00.000Z", by: "Helena Matos" },
  },
  "/propriedades": { pt: { at: "2026-10-11T16:05:00.000Z", by: "Rui Esteves" } },
  "/pre-inscricao": { pt: { at: "2026-09-28T11:20:00.000Z", by: "Helena Matos" } },
  "/termos": { pt: { at: "2026-10-06T08:45:00.000Z", by: "Rui Esteves", reset: true } },
};

const ROWS: SeoPageRow[] = SEO_ROUTES.map((entry) => ({
  route: entry.route,
  pageName: entry.text.pt.pageName,
  dynamic: entry.dynamic,
  path: entry.path,
  locales: {
    pt: {
      defaults: {
        titleTag: entry.text.pt.titleTag,
        metaDescription: entry.text.pt.metaDescription,
      },
      override: OVERRIDES[entry.route]?.pt ?? null,
      lastChange: LAST_CHANGES[entry.route]?.pt ?? null,
    },
    en: {
      defaults: {
        titleTag: entry.text.en.titleTag,
        metaDescription: entry.text.en.metaDescription,
      },
      override: OVERRIDES[entry.route]?.en ?? null,
      lastChange: LAST_CHANGES[entry.route]?.en ?? null,
    },
  },
}));

function AdminSeoDemo({ theme }: { theme: "light" | "dark" }) {
  return (
    <div data-theme={theme} style={{ minHeight: "900px", background: "var(--bg)" }}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <ThemeProvider initialChoice={theme}>
          <ToastProvider>
            <InternalChrome
              role="admin"
              userName="Helena Matos"
              userMeta="Administração · IT"
              activeId="seo"
              locale="pt"
              onLocaleChange={async () => undefined}
              counters={{ propertyModeration: 4, siteLeads: 12 }}
            >
              {/* Ver a nota de topo: `onSave` é um beco sem saída, de propósito. */}
              <SeoManager rows={ROWS} loadError={false} locale="pt" onSave={async () => ({})} />
            </InternalChrome>
          </ToastProvider>
        </ThemeProvider>
      </NextIntlClientProvider>
    </div>
  );
}

export function AdminSeoClaro() {
  return <AdminSeoDemo theme="light" />;
}

export function AdminSeoEscuro() {
  return <AdminSeoDemo theme="dark" />;
}
