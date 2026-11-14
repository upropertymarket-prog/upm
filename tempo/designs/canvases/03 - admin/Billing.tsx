import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import { ToastProvider } from "../../../../packages/ui/src/components/Toast";
import { InternalChrome } from "../../../../apps/interno/src/components/InternalChrome";
import "../../_estilos/shell-no-canvas.css";
import {
  PlansManager,
  type AdminInvoiceRow,
  type BillingSummary,
  type PlanActionState,
  type PlanRow,
  type TrialRequestRow,
} from "../../../../apps/interno/src/app/admin/planos/PlansManager";
import ptMessages from "../../../../packages/config/messages/pt.json";

const planLimits = {
  active_properties: 10,
  visits: 20,
  active_chats: 10,
  saved: 50,
  alerts: 10,
  cloud_gb: 5,
};
const plans: PlanRow[] = [
  {
    planId: "free",
    slug: "gratuito",
    name: "Gratuito",
    audience: "both",
    priceMonthCents: 0,
    priceYearCents: 0,
    introMonthCents: null,
    introYearCents: null,
    visible: true,
    subscribers: 86,
    mrrCents: 0,
    features: ["1 imóvel"],
    limits: { active_properties: 1, cloud_gb: 0 },
    syncedWithStripe: true,
  },
  {
    planId: "essential",
    slug: "essential-owner",
    name: "Essential",
    audience: "owner",
    priceMonthCents: 1999,
    priceYearCents: 19990,
    introMonthCents: 1099,
    introYearCents: 10990,
    visible: true,
    subscribers: 24,
    // Todos ainda dentro da oferta do 1.º ano: o MRR conta o preço que pagam.
    mrrCents: 26376,
    features: ["3 imóveis", "2 GB de Cloud"],
    limits: { active_properties: 3, cloud_gb: 2 },
    syncedWithStripe: true,
  },
  {
    planId: "smarter",
    slug: "smarter-owner",
    name: "Smarter",
    audience: "owner",
    priceMonthCents: 2999,
    priceYearCents: 29990,
    introMonthCents: 1499,
    introYearCents: 14990,
    visible: true,
    subscribers: 31,
    mrrCents: 46469,
    features: ["10 imóveis", "5 GB de Cloud"],
    limits: planLimits,
    syncedWithStripe: true,
  },
  {
    planId: "premium",
    slug: "premium-owner",
    name: "Premium",
    audience: "owner",
    priceMonthCents: 4999,
    priceYearCents: 49990,
    introMonthCents: 2999,
    introYearCents: 29990,
    visible: true,
    subscribers: 12,
    mrrCents: 35988,
    features: ["Imóveis ilimitados", "20 GB de Cloud"],
    limits: { active_properties: null, cloud_gb: 20 },
    syncedWithStripe: true,
  },
];
const summary: BillingSummary = {
  mrrCents: 118833,
  subscribers: 153,
  trials: 8,
  pastDue: 3,
  canceled30d: 4,
  new30d: 16,
  addonSubscribers: 19,
};
const invoices: AdminInvoiceRow[] = [
  {
    id: "invoice-1",
    number: "UPM-2026-0007",
    totalCents: 2999,
    status: "paid",
    issuedAt: "2026-09-30T10:00:00.000Z",
    clientName: "Ana Silva",
    planName: "Smarter",
  },
  {
    id: "invoice-2",
    number: "UPM-2026-0006",
    totalCents: 599,
    status: "paid",
    issuedAt: "2026-09-29T10:00:00.000Z",
    clientName: "João Costa",
    planName: "Essential",
  },
];
const trialRequests: TrialRequestRow[] = [
  {
    id: "trial-1",
    clientName: "Marta Lopes",
    reason: "Ainda estou a reunir a documentação dos imóveis para publicar.",
    status: "pending",
    trialEndsAt: "2026-10-05T10:00:00.000Z",
    createdAt: "2026-09-30T10:00:00.000Z",
  },
];

function AdminBillingDemo({ theme }: { theme: "light" | "dark" }) {
  const save = async (_prev: PlanActionState, _formData: FormData): Promise<PlanActionState> => ({
    ok: true,
  });
  return (
    <div data-theme={theme} style={{ minHeight: "900px", background: "var(--bg)" }}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <ThemeProvider initialChoice={theme}>
          <ToastProvider>
            <InternalChrome
              role="admin"
              userName="Helena Matos"
              userMeta="Administração · IT"
              activeId="plans"
              locale="pt"
              onLocaleChange={async () => undefined}
              counters={{ propertyModeration: 4, siteLeads: 12 }}
            >
              <PlansManager
                plans={plans}
                summary={summary}
                invoices={invoices}
                trialRequests={trialRequests}
                onSave={save}
                onSync={async () => ({ notice: "Catálogo sincronizado com o Stripe." })}
                onDecideTrial={async () => ({ ok: true })}
                onVerifyPin={async () => ({ ok: true })}
              />
            </InternalChrome>
          </ToastProvider>
        </ThemeProvider>
      </NextIntlClientProvider>
    </div>
  );
}

export function AdminPlanosClaro() {
  return <AdminBillingDemo theme="light" />;
}
export function AdminPlanosEscuro() {
  return <AdminBillingDemo theme="dark" />;
}
