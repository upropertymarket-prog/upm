import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import { ToastProvider } from "../../../../packages/ui/src/components/Toast";
import { InternalChrome } from "../../../../apps/interno/src/components/InternalChrome";
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
 * rotas que o ecrã verdadeiro lista. Três levam sobreposição inventada, para a
 * coluna de estado mostrar os três casos que 07 obriga a distinguir: *usa
 * predefinições*, *completo* e *incompleto*. Com todas as linhas no mesmo
 * estado, a coluna que mais importa neste ecrã não se revia.
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

/** Sobreposições de demonstração, por rota. O resto fica em "usa predefinições". */
const OVERRIDES: Record<string, SeoPageRow["override"]> = {
  "/": {
    ...EMPTY_OVERRIDE,
    titleTag: "Propriedades sem comissões em Portugal · UProperty Market",
    metaDescription:
      "Compre e venda diretamente com o proprietário, sem comissões e sem contactos indesejados. Veja as propriedades disponíveis.",
  },
  // Incompleta de propósito: tem título e não tem descrição, que é o caso que
  // o aviso de "incompleto" existe para apanhar.
  "/imoveis": {
    ...EMPTY_OVERRIDE,
    titleTag: "Propriedades à venda e para arrendar · UProperty Market",
    metaDescription: "",
  },
  "/pre-inscricao": {
    ...EMPTY_OVERRIDE,
    titleTag: "Pré-inscrição · UProperty Market",
    metaDescription:
      "Inscreva-se para ser avisado quando as primeiras propriedades abrirem, e garanta os valores de lançamento.",
    noindex: false,
  },
};

/**
 * Última alteração, por rota — os três casos que a coluna tem de distinguir.
 *
 * As três rotas personalizadas trazem data e autor. `/termos` não tem
 * sobreposição e **tem** rasto: é a página que alguém devolveu ao ficheiro, o
 * caso que se perderia se a coluna lesse só a tabela. O resto nunca passou pelo
 * painel e mostra "nunca editada aqui".
 */
const LAST_CHANGES: Record<string, SeoPageRow["lastChange"]> = {
  "/": { at: "2026-10-12T09:30:00.000Z", by: "Helena Matos" },
  "/imoveis": { at: "2026-10-11T16:05:00.000Z", by: "Rui Esteves" },
  "/pre-inscricao": { at: "2026-09-28T11:20:00.000Z", by: "Helena Matos" },
  "/termos": { at: "2026-10-06T08:45:00.000Z", by: "Rui Esteves", reset: true },
};

const ROWS: SeoPageRow[] = SEO_ROUTES.map((entry) => ({
  route: entry.route,
  pageName: entry.pageName,
  dynamic: entry.dynamic,
  defaults: { titleTag: entry.titleTag, metaDescription: entry.metaDescription },
  override: OVERRIDES[entry.route] ?? null,
  lastChange: LAST_CHANGES[entry.route] ?? null,
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
