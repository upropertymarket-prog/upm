import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import { ToastProvider } from "../../../../packages/ui/src/components/Toast";
import { AppChrome } from "../../../../apps/app/src/components/AppChrome";
import { PlanScreen } from "../../../../apps/app/src/components/billing/PlanScreen";
import type {
  AddonOption,
  InvoiceRow,
  PlanOption,
  PlanStatus,
  TrialStatus,
} from "../../../../apps/app/src/lib/billing";
import ptMessages from "../../../../packages/config/messages/pt.json";

const limits = {
  active_properties: 10,
  visits: 20,
  active_chats: 10,
  saved: 50,
  alerts: 10,
  cloud_gb: 5,
};

const plans: PlanOption[] = [
  {
    id: "free",
    slug: "gratuito",
    name: "Gratuito",
    audience: "both",
    priceMonthCents: 0,
    priceYearCents: 0,
    features: ["1 imóvel", "Alertas básicos"],
    limits: { active_properties: 1, visits: 2, active_chats: 2, saved: 10, alerts: 2, cloud_gb: 0 },
    purchasable: false,
  },
  {
    id: "essential",
    slug: "essential-owner",
    name: "Essential",
    audience: "owner",
    priceMonthCents: 599,
    priceYearCents: 5990,
    features: ["3 imóveis", "2 GB de Cloud"],
    limits: {
      active_properties: 3,
      visits: 10,
      active_chats: 5,
      saved: 25,
      alerts: 5,
      cloud_gb: 2,
    },
    purchasable: true,
  },
  {
    id: "smarter",
    slug: "smarter-owner",
    name: "Smarter",
    audience: "owner",
    priceMonthCents: 1499,
    priceYearCents: 14990,
    features: ["10 imóveis", "5 GB de Cloud"],
    limits,
    purchasable: true,
  },
  {
    id: "premium",
    slug: "premium-owner",
    name: "Premium",
    audience: "owner",
    priceMonthCents: 2999,
    priceYearCents: 29990,
    features: ["Imóveis ilimitados", "20 GB de Cloud", "Suporte prioritário"],
    limits: {
      active_properties: null,
      visits: null,
      active_chats: null,
      saved: null,
      alerts: null,
      cloud_gb: 20,
    },
    purchasable: true,
  },
];

const addons: AddonOption[] = [
  {
    id: "cloud",
    slug: "cloud-5gb",
    name: "Cloud 5 GB",
    priceMonthCents: 299,
    priceYearCents: 2990,
    grants: { cloud_gb: 5 },
    purchasable: true,
  },
];
const invoices: InvoiceRow[] = [
  {
    id: "invoice-1",
    number: "UPM-2026-0007",
    totalCents: 2999,
    status: "paid",
    issuedAt: "2026-09-30T10:00:00.000Z",
    hasPdf: true,
    savedToCloud: false,
  },
];
const status: PlanStatus = {
  planId: "smarter",
  planSlug: "smarter-owner",
  planName: "Smarter",
  planAudience: "owner",
  subscriptionId: "sub-demo",
  subscriptionStatus: "active",
  interval: "month",
  currentPeriodEnd: "2026-10-30T10:00:00.000Z",
  cancelAtPeriodEnd: false,
  trialEndsAt: null,
  hasCloudAddon: false,
  limits,
  usage: {
    active_properties: 4,
    visits: 3,
    active_chats: 2,
    saved: 18,
    alerts: 4,
    cloud_gb: 2100000000,
  },
  cloudUsedBytes: 2100000000,
  cloudLimitBytes: 5000000000,
};
const trial: TrialStatus = {
  eligible: false,
  trialing: false,
  trialEndsAt: null,
  requestStatus: null,
  requestReason: null,
};

function BillingDemo({ theme }: { theme: "light" | "dark" }) {
  return (
    <div data-theme={theme} style={{ minHeight: "900px", background: "var(--bg)" }}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <ThemeProvider initialChoice={theme}>
          <ToastProvider>
            <AppChrome
              role="owner"
              userName="Ana Silva"
              userMeta="Proprietária · Smarter"
              activeId="plan"
              locale="pt"
              onLocaleChange={async () => undefined}
              counters={{ leads: 9, messages: 3, visitSchedule: 3, contracts: 1 }}
              notifications={[]}
              liveNotifications={false}
            >
              <PlanScreen
                status={status}
                plans={plans}
                addons={addons}
                invoices={invoices}
                onCheckout={async () => ({ url: "#" })}
                onOpenPortal={async () => ({ url: "#" })}
                onExportInvoice={async () => ({ url: "#" })}
                onSaveInvoice={async () => ({ ok: true })}
                trial={trial}
                onRequestExtension={async () => ({ ok: true })}
              />
            </AppChrome>
          </ToastProvider>
        </ThemeProvider>
      </NextIntlClientProvider>
    </div>
  );
}

export function PlanoClaro() {
  return <BillingDemo theme="light" />;
}
export function PlanoEscuro() {
  return <BillingDemo theme="dark" />;
}
