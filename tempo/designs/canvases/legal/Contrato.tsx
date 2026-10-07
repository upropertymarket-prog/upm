import { NextIntlClientProvider } from "next-intl";

import {
  SubscriptionAgreement,
  type SubscriptionAgreementData,
} from "../../../../apps/app/src/components/billing/SubscriptionAgreement";
import ptMessages from "../../../../packages/config/messages/pt.json";

/**
 * Contrato de adesão — claro e escuro (doc 13).
 * =========================================================================
 * O componente é o real, `SubscriptionAgreement`, e a rota também: desde 7 out
 * 2026 existe `/plano/contrato`, que lê `subscription_agreements` — a tabela
 * que congela plano, preço e limites no dia da celebração (D58).
 *
 * O que continua de demonstração são só os dados. A página real precisa de uma
 * subscrição ativa e da migração `20261007121000` aplicada em staging (D56), e
 * nenhuma das duas existe numa storyboard.
 *
 * **Os valores não foram inventados.** Saem todos de sítios concretos:
 *
 * - plano, preço e limites: o `seed.sql` de 07 §8.3 (Smarter owner, 149,90 €/ano);
 * - período mínimo de 12 meses: decisão do cliente de 7 out 2026 (D51, §7 dos Termos);
 * - versão e aviso de minuta: `2026.10-draft2`, de `legal_documents`;
 * - dados da empresa: marcadores em maiúsculas, porque `app_settings` tem
 *   `company_name`, `company_address`, `company_tax_id`, `company_email` e
 *   `company_phone` todos vazios — 07 §10 proíbe inventá-los.
 *
 * O hash é o de uma versão de demonstração, não o da `draft2` real: calcular o
 * verdadeiro exigiria a migração aplicada, e o que aqui se revê é o
 * enquadramento — que o hash aparece, que cabe na coluna e que não dá rolo
 * horizontal.
 */
const contrato: SubscriptionAgreementData = {
  reference: "UPM-2026-000128",
  celebratedAt: "2026-10-07T14:32:00Z",
  provider: {
    name: "[NOME LEGAL DA EMPRESA]",
    taxId: "[NIPC]",
    email: "[E-MAIL DE CONTACTO]",
    phone: "[TELEFONE]",
    address: "[MORADA]",
  },
  subscriber: {
    name: "Ana Silva",
    taxId: "219 876 543",
    email: "ana.silva@email.pt",
  },
  planName: "Smarter",
  planFeatures: ["10 propriedades ativas", "5 GB de Cloud", "20 visitas por mês"],
  addons: ["Cloud 5 GB"],
  priceCents: 1499,
  priceMonthCents: 1499,
  priceYearCents: 14990,
  currency: "EUR",
  interval: "month",
  startedAt: "2026-10-07T14:32:00Z",
  commitmentMonths: 12,
  commitmentEndsAt: "2027-10-07T14:32:00Z",
  terms: {
    version: "2026.10-draft2",
    contentHash: "4f2a9c1e7b3d5a8f06c4e2b9d7a1f3c5e8b0d2a4f6c8e1b3d5a7f9c2e4b6d8a0",
    acceptedAt: "2026-10-07T14:31:42Z",
    ip: "85.240.12.7",
    pendingLegalReview: true,
  },
  links: { terms: "/termos", privacy: "/privacidade", cookies: "/cookies" },
};

/**
 * O tema fixa-se num `data-theme` à volta de cada ecrã, **não** no
 * `documentElement`: as storyboards partilham o documento do host. O wrapper
 * pinta `bg-bg` e garante `min-h-screen` porque na app é o `<body>` que dá o
 * fundo, e dentro de uma storyboard não há `<body>` próprio.
 *
 * **E repõe `text-text`**, pela mesma razão: `.upm-pagehead__title` não declara
 * cor nenhuma — herda-a —, e quem lha dá na app é o `AppShell`. Sem o shell, o
 * título do contrato saía quase invisível. O componente não está errado; é a
 * moldura que lhe falta aqui.
 *
 * O `max-w-3xl` repete o que a página fará: este ecrã vive dentro do
 * `AppShell`, mas o shell não entra aqui — o que se revê é o documento.
 */
function Ecra({ theme }: { theme: "light" | "dark" }) {
  return (
    <div data-theme={theme} className="min-h-screen bg-bg text-text">
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <main className="mx-auto w-full max-w-3xl px-4 py-16">
          <SubscriptionAgreement data={contrato} />
        </main>
      </NextIntlClientProvider>
    </div>
  );
}

export const ContratoClaro = () => <Ecra theme="light" />;
export const ContratoEscuro = () => <Ecra theme="dark" />;
