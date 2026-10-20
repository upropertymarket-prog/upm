import { NextIntlClientProvider } from "next-intl";
import { ToastProvider } from "../../../../packages/ui/src/components/Toast";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";

import { AuthShell } from "../../../../apps/web/src/components/auth/AuthLayout";
import {
  SubscriptionAgreement,
  type SubscriptionAgreementData,
} from "../../../../apps/app/src/components/billing/SubscriptionAgreement";
import ptMessages from "../../../../packages/config/messages/pt.json";
// O travão de navegação vive no canvas do Proprietário e é importado daqui em
// vez de copiado: é o mesmo problema e a mesma solução. Se vier a ser preciso
// num terceiro canvas, muda-se para uma pasta partilhada — a dois chamadores,
// mover já seria mexer em seis ficheiros para arrumar um.
// 20 out 2026: o caminho passou a ter o número da ordem do menu, com a
// renomeação das pastas dos canvases. Um `import` entre canvases é a conta a
// pagar por não copiar o componente — e paga-se num sítio só.
import { NoNavigation } from "../06 - proprietario/NoNavigation";

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
 * `documentElement`: as storyboards partilham o documento do host.
 *
 * **12 out 2026 — o enquadramento é o pré-login, por decisão do cliente.** Esta
 * storyboard passou por três versões no mesmo dia, e vale a pena o registo:
 *
 * 1. documento sozinho, sem moldura nenhuma;
 * 2. dentro do `AppChrome`, por ser o que a rota `/plano/contrato` faz hoje;
 * 3. dentro do `AuthShell` — **esta** —, porque o contrato tem de ser mostrado
 *    **antes** de a pessoa entrar na app, e o shell só existe depois do login.
 *
 * Ou seja: o que esta storyboard mostra **não é a rota de hoje**, é a proposta.
 * Hoje `/plano/contrato` serve a cópia do contrato já celebrado, autenticada e
 * com shell; o que falta é o documento **completo** aparecer no momento da
 * adesão, onde hoje só há um resumo de seis linhas e uma caixa de aceitação
 * (`RegisterWizard`, passo 4 — ver a storyboard "Contratação" no canvas de
 * Autenticação). É esse ecrã por construir que isto desenha.
 *
 * Quando for implementado, a moldura é a do registo: `AuthShell`, o mesmo que
 * envolve os quatro passos. Daí o `switchPrompt` e os links legais no fundo
 * serem os de `/criar-conta` — não é decoração copiada, é o mesmo invólucro.
 */
function Ecra({ theme }: { theme: "light" | "dark" }) {
  return (
    <div data-theme={theme} style={{ minHeight: "900px", background: "var(--bg)" }}>
      <NoNavigation>
        <NextIntlClientProvider locale="pt" messages={ptMessages}>
          <ThemeProvider initialChoice={theme}>
            <ToastProvider>
              <AuthShell
                // `xl` e não o `lg` do registo: um contrato é documento, não
                // formulário — a `lg` as tabelas de duas colunas partiam cada
                // valor em três linhas.
                width="xl"
                switchPrompt="Já tem conta?"
                switchHref="/entrar"
                switchLabel="Entrar"
                legalLabel="Termos e Condições"
                privacyLabel="Política de Privacidade"
                cookiesLabel="Política de Cookies"
              >
                <SubscriptionAgreement data={contrato} />
              </AuthShell>
            </ToastProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </NoNavigation>
    </div>
  );
}

export const ContratoClaro = () => <Ecra theme="light" />;
export const ContratoEscuro = () => <Ecra theme="dark" />;
