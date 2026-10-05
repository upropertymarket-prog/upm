import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import { ToastProvider } from "../../../../packages/ui/src/components/Toast";
import { PageHeader } from "../../../../packages/ui/src/shell/PageHeader";

import { AppChrome } from "../../../../apps/app/src/components/AppChrome";
import { PropertyFilters } from "../../../../apps/app/src/components/market/PropertyFilters";
import { MarketResults } from "../../../../apps/app/src/components/market/MarketResults";
import { PropertyDetail } from "../../../../apps/app/src/components/market/PropertyDetail";
import { ContactActions } from "../../../../apps/app/src/components/market/ContactActions";
import { PropertyListing } from "../../../../apps/app/src/components/my-properties/PropertyListing";
import { PropertyFormWizard } from "../../../../apps/app/src/components/properties/PropertyFormWizard";
import ptMessages from "../../../../packages/config/messages/pt.json";
import { demoLocaleChange, demoNotifications, demoOk, demoStartConversation } from "./demo";
import {
  demoDetail,
  demoDetailLocation,
  demoFormActions,
  demoListingRows,
  demoMarketCards,
  demoPhotos,
} from "./demoMarket";

/**
 * Ecrãs de imóveis do Proprietário — Market, Detalhe, As minhas propriedades e
 * Nova propriedade.
 *
 * Estas quatro storyboards foram removidas na Fase 4 porque eram UI escrita
 * dentro da pasta do canvas, com pixels e cores próprios — uma reconstrução que
 * deixava de dizer a verdade sobre o produto assim que a página mudasse (ver o
 * doc "Registo — storyboards do Proprietário removidas (Fase 4)"). Voltam agora
 * como o que deviam ter sido desde o início: um invólucro fino à volta dos
 * componentes que as rotas usam.
 *
 * O Detalhe só pôde voltar depois de `/market/[id]` deixar de ter a ficha
 * escrita dentro da própria página — hoje é o `PropertyDetail`, que recebe
 * tudo por prop, e é esse mesmo componente que aqui se monta.
 *
 * Tudo por prop e nada por rede: sem sessão, sem Supabase e sem relógio.
 */
function Shell({
  theme,
  activeId,
  children,
}: {
  theme: "light" | "dark";
  activeId: string;
  children: React.ReactNode;
}) {
  return (
    <div data-theme={theme} style={{ background: "var(--bg)", height: "900px" }}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <ThemeProvider initialChoice={theme}>
          <ToastProvider>
            <AppChrome
              role="owner"
              userName="Ana Silva"
              userMeta="Proprietária · Premium"
              activeId={activeId}
              locale="pt"
              onLocaleChange={demoLocaleChange}
              counters={{ leads: 9, messages: 3, visitSchedule: 3, contracts: 1 }}
              notifications={demoNotifications}
              liveNotifications={false}
            >
              {children}
            </AppChrome>
          </ToastProvider>
        </ThemeProvider>
      </NextIntlClientProvider>
    </div>
  );
}

type Tema = { theme: "light" | "dark" };

/** `/market` — filtros por cima, grelha de cartões por baixo (04 §8.2). */
function MarketDemo({ theme }: Tema) {
  return (
    <Shell theme={theme} activeId="market">
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <PageHeader title="Market" subtitle={`${demoMarketCards.length} imóveis publicados`} />
        <PropertyFilters />
        <MarketResults properties={demoMarketCards} page={1} pageCount={3} query="" />
      </div>
    </Shell>
  );
}

/**
 * `/market/[id]` — a ficha do imóvel.
 *
 * Sem `SaveButton`: guardar é do comprador, e quem está aqui é a proprietária.
 * `ContactActions` fica ativo — uma proprietária que vê o imóvel de outra
 * pessoa contacta como qualquer outro utilizador.
 */
function DetalheDemo({ theme }: Tema) {
  return (
    <Shell theme={theme} activeId="market">
      <PropertyDetail
        property={demoDetail}
        photos={demoPhotos}
        location={demoDetailLocation}
        price="485 000 €"
        ownerName="Miguel Antunes"
        actions={
          <ContactActions
            propertyId="p1"
            propertyTitle={demoDetail.title ?? "Imóvel"}
            onContact={demoStartConversation}
            onRequestVisit={demoOk}
          />
        }
      />
    </Shell>
  );
}

/** `/propriedades` — a carteira da proprietária, com filtro de estado. */
function PropriedadesDemo({ theme }: Tema) {
  return (
    <Shell theme={theme} activeId="myProperties">
      <PropertyListing rows={demoListingRows} statusValue="" onArchive={demoOk} />
    </Shell>
  );
}

/**
 * `/propriedades/nova` — o wizard de cinco passos, no primeiro.
 *
 * O wizard cria um rascunho assim que monta; `demoFormActions.createDraft`
 * devolve um id fixo para a storyboard não mudar de montagem para montagem.
 */
function NovaPropriedadeDemo({ theme }: Tema) {
  return (
    <Shell theme={theme} activeId="myProperties">
      <PropertyFormWizard actions={demoFormActions} />
    </Shell>
  );
}

export function MarketClaro() {
  return <MarketDemo theme="light" />;
}
export function MarketEscuro() {
  return <MarketDemo theme="dark" />;
}
export function DetalheClaro() {
  return <DetalheDemo theme="light" />;
}
export function DetalheEscuro() {
  return <DetalheDemo theme="dark" />;
}
export function PropriedadesClaro() {
  return <PropriedadesDemo theme="light" />;
}
export function PropriedadesEscuro() {
  return <PropriedadesDemo theme="dark" />;
}
export function NovaPropriedadeClaro() {
  return <NovaPropriedadeDemo theme="light" />;
}
export function NovaPropriedadeEscuro() {
  return <NovaPropriedadeDemo theme="dark" />;
}
