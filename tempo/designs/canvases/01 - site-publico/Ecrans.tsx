import type { ReactNode } from "react";
import Link from "next/link";
import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";

import { HomeSections } from "../../../../apps/web/src/components/site/HomeSections";
import { PreRegistrationForm } from "../../../../apps/web/src/app/pre-inscricao/PreRegistrationForm";
import { FeatureGrid } from "../../../../apps/web/src/components/site/FeatureGrid";
import { SectionHeading, SiteSection } from "../../../../apps/web/src/components/site/SiteSection";
import { ListingDetail } from "../../../../apps/web/src/components/site/ListingDetail";
import { ListingsBrowser } from "../../../../apps/web/src/components/site/ListingsBrowser";
import { PublicHeader } from "../../../../apps/web/src/components/PublicHeader";
import { SiteFooter } from "../../../../apps/web/src/components/site/SiteFooter";
import { COMING_SOON_CARDS } from "../../../../apps/web/src/lib/site-content";
import type { PublicPlan } from "../../../../apps/web/src/components/site/Pricing";
import type {
  PublicListingCard,
  PublicListingDetail,
} from "../../../../apps/web/src/lib/public-listings";
import ptMessages from "../../../../packages/config/messages/pt.json";

/**
 * Site público — pré e pós-lançamento, nos dois temas.
 * =========================================================================
 * **Os componentes são os reais.** `HomeSections` é o mesmo que a `page.tsx`
 * de `/` renderiza, e o texto vem do mesmo `site-content.ts`. O que este
 * ficheiro faz é só o que uma storyboard não consegue obter sozinha: dar-lhe o
 * modo do site e o catálogo de planos por prop.
 *
 * Foi por isso que `HomeSections` saiu da `page.tsx` a 7 out 2026. A página é
 * um Server Component que lê `feature_flags` e `plans` — nada disso corre
 * dentro de uma storyboard, e reconstruir a home à mão aqui seria a segunda
 * cópia que o canvas de `legal` já aprendeu a não fazer (ver o comentário de
 * `Ecrans.tsx` desse canvas: "um excerto escrito à mão é uma segunda cópia de
 * um contrato, que diverge à primeira cláusula alterada").
 *
 * **O único dado inventado são os planos**, e é deliberado. Os valores reais
 * em staging são os do teste do Stripe — "Smarter (teste)" a 149,90 €/ano —
 * e rever a página de preços com eles seria rever o ecrã errado. Os números
 * abaixo são os de 07 §8.3, que é o que a página vai mostrar quando o
 * catálogo for corrigido no Admin. Em produção nada disto é lido: a página
 * usa `getPublicPlans()`, e `public-site.test.ts` garante que o que o
 * visitante vê é o que está na base de dados.
 *
 * Três decisões herdadas do canvas `legal`, que custaram tentativas lá:
 *
 *  1. **Sem `intrinsicSizing`** — estas páginas têm largura máxima e
 *     centram-se; medir pelo conteúdo colapsava a moldura, fazia desaparecer
 *     as margens reais e punha cada moldura por cima da seguinte. O
 *     `index.canvas.tsx` tem o relato completo — a regra estava escrita aqui
 *     e foi quebrada no canvas, o que é o pior dos dois mundos.
 *  2. **O tema fixa-se num `data-theme` à volta de cada ecrã**, nunca no
 *     `documentElement`: as storyboards partilham o documento do host, e
 *     escrever na raiz faria a última a renderizar arrastar as outras.
 *  3. **O envoltório pinta o fundo e garante `min-h-screen`**: na app é o
 *     `<body>` que o dá, e dentro de uma storyboard não há `<body>` próprio.
 */

/**
 * Propriedades de demonstração (P2-05).
 *
 * **Inventadas, e pela mesma razão dos planos — mas por um motivo mais forte.**
 * Verificado em staging a 12 out 2026: as 23 propriedades que lá estão são fixtures
 * dos testes de faturação (`ref` a começar em `BILL-`), **todas em `draft`**,
 * com título vazio, sem preço, sem localidade — e `property_media` está vazia,
 * ou seja não existe **uma única fotografia** no projeto. `properties_public`
 * filtra `status in ('active','featured')`, por isso o site público vê zero
 * linhas, corretamente.
 *
 * Revê-se o ecrã com estes dados ou não se revê nenhum. O que a storyboard
 * mostra é o enquadramento — a grelha, o cartão, o ritmo do detalhe, a coluna de
 * ação —, e isso é o que tem de estar certo antes de existirem propriedades reais.
 *
 * A capa fica `null` de propósito: sem fotografias no projeto, qualquer URL que
 * se pusesse aqui seria um link morto, e o estado "sem fotografia" é o que o
 * site vai mostrar nos primeiros anúncios de quem não carregar imagens.
 */
const PROPRIEDADES: PublicListingCard[] = [
  {
    id: "0f8fad5b-d9cb-469f-a165-70867728950e",
    slug: "apartamento-t2-com-varanda-no-porto-0f8fad5b-d9cb-469f-a165-70867728950e",
    title: "Apartamento T2 com varanda no Porto",
    deal: "sale",
    typology: "T2",
    city: "Porto",
    grossArea: 88,
    bedrooms: 2,
    bathrooms: 1,
    priceCents: 24500000,
    rentCents: null,
    coverUrl: null,
    publishedAt: "2026-10-10T09:00:00Z",
  },
  {
    id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
    slug: "moradia-t4-em-braga-1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
    title: "Moradia T4 em Braga, com jardim",
    deal: "sale",
    typology: "T4",
    city: "Braga",
    grossArea: 210,
    bedrooms: 4,
    bathrooms: 3,
    priceCents: 39000000,
    rentCents: null,
    coverUrl: null,
    publishedAt: "2026-10-09T14:30:00Z",
  },
  {
    id: "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e",
    slug: "t1-mobilado-em-lisboa-2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e",
    title: "T1 mobilado em Lisboa, junto ao metro",
    deal: "rent",
    typology: "T1",
    city: "Lisboa",
    grossArea: 46,
    bedrooms: 1,
    bathrooms: 1,
    priceCents: null,
    rentCents: 95000,
    coverUrl: null,
    publishedAt: "2026-10-08T11:15:00Z",
  },
  {
    id: "3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f",
    slug: "estudio-em-coimbra-3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f",
    title: "Estúdio remodelado em Coimbra",
    deal: "rent",
    typology: "T0",
    city: "Coimbra",
    grossArea: 32,
    bedrooms: 0,
    bathrooms: 1,
    priceCents: null,
    rentCents: 58000,
    coverUrl: null,
    publishedAt: "2026-10-07T16:45:00Z",
  },
  {
    id: "4d5e6f7a-8b9c-4d0e-9f2a-3b4c5d6e7f80",
    slug: "quinta-com-2-hectares-em-evora-4d5e6f7a-8b9c-4d0e-9f2a-3b4c5d6e7f80",
    title: "Quinta com 2 hectares em Évora",
    deal: "sale",
    typology: "T5+",
    city: "Évora",
    grossArea: 320,
    bedrooms: 5,
    bathrooms: 4,
    priceCents: 58000000,
    rentCents: null,
    coverUrl: null,
    publishedAt: "2026-10-06T10:00:00Z",
  },
  {
    id: "5e6f7a8b-9c0d-4e1f-8a3b-4c5d6e7f8091",
    slug: "t3-em-faro-a-500-m-da-praia-5e6f7a8b-9c0d-4e1f-8a3b-4c5d6e7f8091",
    title: "T3 em Faro, a 500 m da praia",
    deal: "sale",
    typology: "T3",
    city: "Faro",
    grossArea: 124,
    bedrooms: 3,
    bathrooms: 2,
    priceCents: 31500000,
    rentCents: null,
    coverUrl: null,
    publishedAt: "2026-10-05T08:20:00Z",
  },
];

/** O detalhe do primeiro, com o que a view expõe além do cartão. */
const DETALHE: PublicListingDetail = {
  ...PROPRIEDADES[0],
  ref: "UPM-2026-0412",
  description:
    "Apartamento T2 no segundo andar, com varanda virada a sul e vista desafogada. Cozinha equipada, dois quartos com roupeiro e sala com acesso direto à varanda. Prédio com elevador, a cinco minutos a pé do metro.\n\nDisponível para visitas a partir do próximo mês. Falo diretamente com quem tiver interesse, sem intermediários.",
  propertyType: "Apartamento",
  condition: "Remodelado",
  netArea: 74,
  floor: "2.º",
  yearBuilt: 1998,
  energyCert: "B-",
  condoFeeCents: 4500,
  amenities: ["Varanda", "Elevador", "Cozinha equipada", "Roupeiros", "Vidros duplos"],
  parish: "Bonfim",
  district: "Porto",
  // Ponto aproximado, que é o único que `properties_public` expõe (08 §2.7).
  approx: { lon: -8.595, lat: 41.153, radiusM: 500 },
  photoUrls: [],
};

/** Os preços de 07 §8.3 — ver a nota acima sobre porque não são os de staging. */
const PLANOS: PublicPlan[] = [
  {
    slug: "essential-owner",
    name: "Essential",
    audience: "owner",
    priceYearCents: 599,
    priceMonthCents: 69,
    features: [
      "1 propriedade ativa",
      "Até 3 visitas agendadas",
      "Até 1 chat ativo",
      "Suporte normal",
    ],
    highlighted: false,
  },
  {
    slug: "smarter-owner",
    name: "Smarter",
    audience: "owner",
    priceYearCents: 2990,
    priceMonthCents: 299,
    features: [
      "Até 5 propriedades ativas",
      "Até 5 visitas agendadas",
      "Até 4 chats ativos",
      "Suporte prioritário",
      "Cloud de documentação",
    ],
    highlighted: true,
  },
  {
    slug: "premium-owner",
    name: "Premium",
    audience: "owner",
    priceYearCents: 5990,
    priceMonthCents: 599,
    features: [
      "Propriedades ilimitadas",
      "Visitas e agenda ilimitadas",
      "Chats ilimitados",
      "Suporte premium",
      "Cloud de documentação 20 GB",
    ],
    highlighted: false,
  },
  {
    slug: "smarter-buyer",
    name: "Smarter",
    audience: "buyer",
    priceYearCents: 2990,
    priceMonthCents: 299,
    features: [
      "Até 25 propriedades guardadas",
      "Até 5 chats ativos",
      "Alertas de descida de preço",
      "Agenda de visitas",
    ],
    highlighted: true,
  },
  {
    slug: "premium-buyer",
    name: "Premium",
    audience: "buyer",
    priceYearCents: 4990,
    priceMonthCents: 499,
    features: [
      "Guardados ilimitados",
      "Chats ilimitados",
      "Alertas em tempo real",
      "Prioridade em visitas",
      "Contratos digitais ilimitados",
    ],
    highlighted: false,
  },
];

/**
 * A moldura: tema por atributo, fundo próprio, mensagens PT.
 *
 * **Porque é que aqui há `ThemeProvider` e no canvas `legal` não.** O
 * `PublicHeader` tem o `ThemeToggle`, que chama `useTheme()` e rebenta sem
 * provider — foi assim que a primeira captura falhou (`useTheme tem de ser
 * usado dentro de <ThemeProvider>`). O provider escreve no `documentElement`,
 * que as storyboards partilham, e é exatamente a armadilha que o canvas
 * `legal` registou.
 *
 * A saída é a ordem: **provider por fora, `data-theme` por dentro**. O
 * atributo mais próximo é o que os tokens CSS resolvem, por isso cada
 * storyboard mantém o seu tema mesmo que o provider ponha outro na raiz. O que
 * fica partilhado é só o estado visual do botão do tema — que não é o que se
 * revê aqui.
 */
/**
 * O texto de "Em breve", lido do ficheiro de mensagens em vez de um `t()`.
 *
 * A copy do site saiu do `site-content.ts` para `messages/*.json` a 20 out 2026
 * (D72). Aqui não se pode usar `useTranslations`: quem monta estes ecrãs
 * devolve `<Ecra>…</Ecra>`, e é o `Ecra` que monta o
 * `NextIntlClientProvider` — um hook chamado no componente de fora fica
 * **acima** do provider que ele próprio cria, e atirava. Ler o `ptMessages`
 * diretamente é o mesmo caminho que o provider já usa duas linhas abaixo, e
 * uma storyboard é de propósito de um idioma só: o que se revê aqui é o
 * desenho, não a tradução.
 */
const EM_BREVE = ptMessages.site.comingSoon;

const cartoesEmBreve = () =>
  COMING_SOON_CARDS.map((card) => ({
    icon: card.icon,
    title: EM_BREVE.cards[card.id as keyof typeof EM_BREVE.cards].title,
    body: EM_BREVE.cards[card.id as keyof typeof EM_BREVE.cards].body,
  }));

function Ecra({ theme, children }: { theme: "light" | "dark"; children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ThemeProvider initialChoice={theme}>
        <div
          data-theme={theme}
          data-app="web"
          style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}
        >
          {children}
        </div>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}

/** Trocar o idioma dentro de uma storyboard não leva a lado nenhum. */
const semEfeito = () => undefined;

/** Os formulários do canvas não submetem: devolvem o estado inicial. */
const semSubmissao = async () => ({});

function Home({ theme, launchMode }: { theme: "light" | "dark"; launchMode: "pre" | "post" }) {
  return (
    <Ecra theme={theme}>
      <HomeSections
        launchMode={launchMode}
        plans={PLANOS}
        locale="pt"
        onLocaleChange={semEfeito}
        onContact={semSubmissao}
        // Em `pre` a secção não existe e a lista nunca é lida; passar sempre
        // mantém as duas storyboards com o mesmo chamador.
        recentListings={PROPRIEDADES}
      />
    </Ecra>
  );
}

export function PreLancamentoClaro() {
  return <Home theme="light" launchMode="pre" />;
}

export function PreLancamentoEscuro() {
  return <Home theme="dark" launchMode="pre" />;
}

export function PosLancamentoClaro() {
  return <Home theme="light" launchMode="post" />;
}

export function PosLancamentoEscuro() {
  return <Home theme="dark" launchMode="post" />;
}

/**
 * `/pre-inscricao` — o destino de todos os CTA em modo `pre`.
 *
 * Aqui a moldura reproduz o enquadramento da `page.tsx` em vez de importar o
 * componente de página: essa é `async` e lê `launch_mode`. O que importa
 * rever — o formulário, os consentimentos separados, os quatro cartões — são
 * os componentes reais.
 */
/**
 * `/propriedades` — o Market público (P2-05).
 *
 * `ListingsBrowser` é o mesmo componente que a `page.tsx` renderiza; o que ela
 * faz e aqui não se faz é validar os parâmetros do URL e consultar a base de
 * dados. Duas storyboards, porque os dois estados que se revêem são diferentes:
 * com resultados e sem nenhum — o segundo é o que um visitante vê ao filtrar
 * por uma localidade onde ainda não há nada, e é fácil de deixar feio.
 */
function Imoveis({ theme, listings }: { theme: "light" | "dark"; listings: PublicListingCard[] }) {
  return (
    <Ecra theme={theme}>
      {/* A moldura da página — cabeçalho, `main`, rodapé — é reproduzida aqui
          porque vive na `page.tsx` e não no `ListingsBrowser`. São três
          elementos e nenhum conteúdo: sem eles a storyboard mostrava a lista a
          flutuar, sem a navbar com que o visitante a vê. O conteúdo em si
          continua a ser o componente real. */}
      <PublicHeader locale="pt" onLocaleChange={semEfeito} launchMode="post" />
      <main>
        <SiteSection>
          <ListingsBrowser
            listings={listings}
            total={listings.length}
            page={1}
            pageCount={1}
            raw={listings.length === 0 ? { cidade: "Guarda" } : {}}
          />
        </SiteSection>
      </main>
      <SiteFooter />
    </Ecra>
  );
}

export function ImoveisClaro() {
  return <Imoveis theme="light" listings={PROPRIEDADES} />;
}

export function ImoveisEscuro() {
  return <Imoveis theme="dark" listings={PROPRIEDADES} />;
}

export function ImoveisSemResultados() {
  return <Imoveis theme="light" listings={[]} />;
}

export function ImoveisSemResultadosEscuro() {
  return <Imoveis theme="dark" listings={[]} />;
}

/**
 * `/propriedades` em **pré-lançamento** — o outro ramo inteiro da mesma rota.
 *
 * A `page.tsx` tem dois retornos: com catálogo e, em `pre`, uma página que diz
 * que ainda não abriu e leva à pré-inscrição. Esse segundo ramo é o que
 * **todos** os visitantes vão ver até ao lançamento — era o ecrã mais visto do
 * site e não tinha storyboard nenhuma. Sem ela, o que se revia do Market era só
 * o estado que ainda não existe.
 */
function ImoveisPreLancamento({ theme }: { theme: "light" | "dark" }) {
  return (
    <Ecra theme={theme}>
      <PublicHeader locale="pt" onLocaleChange={semEfeito} launchMode="pre" />
      <main>
        <SiteSection>
          <div style={{ display: "grid", gap: "var(--sp-6)" }}>
            <SectionHeading
              eyebrow={EM_BREVE.eyebrow}
              title={EM_BREVE.title}
              body={EM_BREVE.body}
              align="center"
            />
            <FeatureGrid cards={cartoesEmBreve()} minColumn="14rem" />
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Link href="/pre-inscricao" className="upm-btn upm-btn--primary upm-btn--md">
                {EM_BREVE.primaryCta}
              </Link>
            </div>
          </div>
        </SiteSection>
      </main>
      <SiteFooter />
    </Ecra>
  );
}

export function ImoveisPreLancamentoClaro() {
  return <ImoveisPreLancamento theme="light" />;
}

export function ImoveisPreLancamentoEscuro() {
  return <ImoveisPreLancamento theme="dark" />;
}

/**
 * `/propriedades/[slug]` — o detalhe de propriedade (P2-05).
 *
 * O mapa aparece como o visitante o vê de início: fechado, com o aviso de que
 * carregá-lo expõe o IP ao OpenFreeMap. É deliberado que a storyboard mostre
 * esse estado e não o mapa aberto — é o estado por omissão da página, e é o que
 * se revê.
 */
function Detalhe({ theme }: { theme: "light" | "dark" }) {
  return (
    <Ecra theme={theme}>
      <ListingDetail listing={DETALHE} locale="pt" launchMode="post" onLocaleChange={semEfeito} />
    </Ecra>
  );
}

export function FichaClaro() {
  return <Detalhe theme="light" />;
}

export function FichaEscuro() {
  return <Detalhe theme="dark" />;
}

function PreInscricao({ theme }: { theme: "light" | "dark" }) {
  return (
    <Ecra theme={theme}>
      {/* Cabeçalho e rodapé reproduzidos como na `page.tsx`: a página de
          conversão do pré-lançamento tem navbar, e sem ela a storyboard
          mostrava o formulário a flutuar — o visitante nunca o vê assim. Em
          `pre` o cabeçalho é o que dá a saída para a home e para `/propriedades`,
          por isso é parte do que se revê, não moldura decorativa. */}
      <PublicHeader locale="pt" onLocaleChange={semEfeito} launchMode="pre" />
      <main>
        <SiteSection>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(20rem, 100%), 1fr))",
              gap: "clamp(1.5rem, 4vw, 3rem)",
              alignItems: "start",
            }}
          >
            <div style={{ display: "grid", gap: "var(--sp-6)" }}>
              <SectionHeading
                eyebrow={EM_BREVE.eyebrow}
                title={EM_BREVE.title}
                body={EM_BREVE.body}
              />
              <FeatureGrid cards={cartoesEmBreve()} minColumn="13rem" />
            </div>
            <PreRegistrationForm onSubmit={semSubmissao} />
          </div>
        </SiteSection>
      </main>
      <SiteFooter />
    </Ecra>
  );
}

export function PreInscricaoClaro() {
  return <PreInscricao theme="light" />;
}

export function PreInscricaoEscuro() {
  return <PreInscricao theme="dark" />;
}
