import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import { ToastProvider } from "../../../../packages/ui/src/components/Toast";
import { InternalChrome } from "../../../../apps/interno/src/components/InternalChrome";
import { DashboardView } from "../../../../apps/interno/src/app/admin/painel/DashboardView";
import type { AdminDashboardPayload } from "../../../../apps/interno/src/lib/admin-shell";
import { ModerationView } from "../../../../apps/interno/src/app/admin/imoveis/ModerationView";
import { LeadsManager } from "../../../../apps/interno/src/app/admin/leads-site/LeadsManager";
import type { LeadFilters } from "../../../../apps/interno/src/app/admin/leads-site/actions";
import { SettingsManager } from "../../../../apps/interno/src/app/admin/definicoes/SettingsManager";
import type { Database, Json } from "../../../../packages/db/src/database.types";
import type { VerifyPinAction } from "../../../../apps/interno/src/components/stepUpTypes";
import ptMessages from "../../../../packages/config/messages/pt.json";

type ModerationRow = Database["public"]["Functions"]["admin_list_moderation"]["Returns"][number] & {
  coverUrl: string | null;
};
type ModerationDetail =
  Database["public"]["Functions"]["admin_moderation_detail"]["Returns"][number];
type ModerationEvent =
  Database["public"]["Functions"]["admin_property_moderation_history"]["Returns"][number];

const verifyPin: VerifyPinAction = async () => ({ ok: true });
const dashboard: AdminDashboardPayload = {
  summary: {
    users_total: 284,
    users_new_30d: 32,
    buyers: 170,
    owners: 98,
    active_properties: 76,
    featured_properties: 8,
    pending_moderation: 4,
    new_leads: 12,
  },
  daily: Array.from({ length: 30 }, (_, index) => ({
    date: new Date(Date.UTC(2026, 8, index + 1)).toISOString().slice(0, 10),
    registrations:
      [
        2, 5, 3, 6, 4, 8, 6, 9, 5, 7, 11, 8, 10, 7, 12, 9, 6, 13, 10, 12, 8, 14, 11, 15, 9, 12, 16,
        10, 13, 18,
      ][index] ?? 0,
    properties_submitted:
      [0, 2, 1, 2, 1, 3, 2, 4, 1, 3, 4, 2, 3, 2, 5, 4, 3, 5, 3, 6, 4, 5, 3, 7, 4, 5, 8, 4, 6, 9][
        index
      ] ?? 0,
  })),
  activity: [
    { action: "property_approved", entity: "property", created_at: "2026-10-02T09:42:00.000Z" },
    { action: "lead_status", entity: "lead", created_at: "2026-10-02T08:16:00.000Z" },
    { action: "plan_updated", entity: "plan", created_at: "2026-10-01T16:30:00.000Z" },
  ],
};

const properties: ModerationRow[] = [
  {
    id: "bb000000-0000-4000-8000-000000000001",
    ref: "UPM-2408",
    title: "Apartamento luminoso junto ao jardim",
    deal: "sale",
    status: "pending_review",
    city: "Lisboa",
    price_cents: 34500000,
    rent_cents: null,
    owner_name: "Marta Oliveira",
    cover_path: null,
    coverUrl: null,
    created_at: "2026-10-02T08:30:00.000Z",
  },
  {
    id: "bb000000-0000-4000-8000-000000000002",
    ref: "UPM-2407",
    title: "Moradia com terraço",
    deal: "rent",
    status: "pending_review",
    city: "Oeiras",
    price_cents: null,
    rent_cents: 145000,
    owner_name: "Rui Costa",
    cover_path: null,
    coverUrl: null,
    created_at: "2026-10-01T16:12:00.000Z",
  },
];
const selectedProperty: ModerationDetail = {
  id: properties[0]!.id,
  owner_id: "cc000000-0000-4000-8000-000000000001",
  owner_name: "Marta Oliveira",
  title: properties[0]!.title,
  description:
    "Apartamento renovado, com luz natural durante todo o dia e acesso fácil aos transportes.",
  ref: properties[0]!.ref,
  deal: "sale",
  status: "pending_review",
  property_type: "Apartamento",
  typology: "T2",
  condition: "Renovado",
  gross_area: 104,
  net_area: 92,
  bedrooms: 2,
  bathrooms: 2,
  floor: "3.º",
  year_built: 2018,
  energy_cert: "A",
  price_cents: 34500000,
  rent_cents: null,
  condo_fee_cents: 6500,
  imi_cents: 32000,
  amenities: ["Elevador", "Varanda"],
  address_line: "Rua do Jardim, 24",
  postal_code: "1200-123",
  city: "Lisboa",
  parish: "Estrela",
  district: "Lisboa",
  rejection_reason: null,
  published_at: null,
  created_at: "2026-10-02T08:30:00.000Z",
};
const moderationHistory: ModerationEvent[] = [
  {
    id: 21,
    action: "reopened",
    status_from: "rejected",
    status_to: "pending_review",
    reason: "Documentação atualizada pelo proprietário.",
    actor_name: "Helena Matos",
    created_at: "2026-10-02T08:20:00.000Z",
  },
];

const leadId = "aa000000-0000-4000-8000-000000000001";
const leadRows: Database["public"]["Functions"]["admin_list_site_leads"]["Returns"] = [
  {
    id: leadId,
    source: "pre_launch",
    form: "preinscricao",
    name: "Ana Demonstração",
    email: "ana@example.invalid",
    phone: null,
    profile_type: "buyer",
    reason: "Procura casa",
    status: "new",
    assigned_to: null,
    assigned_name: null,
    consent_marketing: false,
    created_at: "2026-10-02T09:10:00.000Z",
  },
  {
    id: "aa000000-0000-4000-8000-000000000002",
    source: "post_launch",
    form: "empresas",
    name: "Equipa Exemplo",
    email: "contacto@example.invalid",
    phone: "+351 210 000 000",
    profile_type: "empresa",
    reason: "Parceria",
    status: "contacted",
    assigned_to: "cc000000-0000-4000-8000-000000000002",
    assigned_name: "Helena Matos",
    consent_marketing: false,
    created_at: "2026-10-01T14:00:00.000Z",
  },
];
const selectedLead: Database["public"]["Functions"]["admin_site_lead_detail"]["Returns"][number] = {
  ...leadRows[0]!,
  message: "Procuro um T2 na zona de Lisboa e gostaria de saber quando abre o serviço.",
  utm: { utm_source: "demo", utm_medium: "newsletter" } as Json,
  consent_at: null,
  updated_at: "2026-10-02T09:10:00.000Z",
};
const leadHistory: Database["public"]["Functions"]["admin_site_lead_history"]["Returns"] = [
  {
    id: 2,
    kind: "note",
    body: "Prefere contacto por e-mail depois das 17h.",
    actor_name: "Helena Matos",
    created_at: "2026-10-02T10:00:00.000Z",
  },
  {
    id: 1,
    kind: "status",
    body: "new -> contacted",
    actor_name: "Helena Matos",
    created_at: "2026-10-02T09:40:00.000Z",
  },
];
const leadFilters: LeadFilters = {
  status: null,
  source: null,
  form: null,
  assignedTo: null,
  search: "",
};
const stubResult = async () => ({ ok: true });

function Frame({
  theme,
  activeId,
  children,
}: {
  theme: "light" | "dark";
  activeId: string;
  children: React.ReactNode;
}) {
  return (
    <div data-theme={theme} style={{ minHeight: 900, background: "var(--bg)" }}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <ThemeProvider initialChoice={theme}>
          <ToastProvider>
            <InternalChrome
              role="admin"
              userName="Helena Matos"
              userMeta="Administração"
              activeId={activeId}
              locale="pt"
              onLocaleChange={async () => undefined}
              counters={{ propertyModeration: 4, siteLeads: 12 }}
            >
              {children}
            </InternalChrome>
          </ToastProvider>
        </ThemeProvider>
      </NextIntlClientProvider>
    </div>
  );
}

export function AdminPainelClaro() {
  return (
    <Frame theme="light" activeId="dashboard">
      <DashboardView data={dashboard} mrrCents={128700} locale="pt" loadError={false} />
    </Frame>
  );
}
export function AdminPainelEscuro() {
  return (
    <Frame theme="dark" activeId="dashboard">
      <DashboardView data={dashboard} mrrCents={128700} locale="pt" loadError={false} />
    </Frame>
  );
}

function ModerationDemo({ theme, detail }: { theme: "light" | "dark"; detail: boolean }) {
  const tail = properties[properties.length - 1]!;
  return (
    <Frame theme={theme} activeId="propertyModeration">
      <ModerationView
        status="pending_review"
        properties={properties}
        counts={{ pending_review: 4, active: 76, rejected: 3, featured: 8 }}
        pageInfo={{
          page: 1,
          pageCount: 2,
          hasNext: true,
          hasPrevious: false,
          firstCursor: { createdAt: properties[0]!.created_at, id: properties[0]!.id },
          lastCursor: { createdAt: tail.created_at, id: tail.id },
        }}
        selectedProperty={detail ? selectedProperty : null}
        media={
          detail
            ? [
                {
                  id: "media-1",
                  path: "demo/apt.jpg",
                  kind: "photo",
                  position: 0,
                  is_cover: true,
                  signedUrl: "",
                },
              ]
            : []
        }
        documents={
          detail
            ? [
                {
                  id: "doc-1",
                  name: "Certificado energético.pdf",
                  mime: "application/pdf",
                  size: 200000,
                  kind: "energetico",
                  storage_path: "demo/cert.pdf",
                  signedUrl: "",
                },
              ]
            : []
        }
        history={detail ? moderationHistory : []}
        exactLocation={detail ? "38.7138, -9.1468" : null}
        selectedPropertyError={false}
        loadError={false}
        locale="pt"
        onModerate={stubResult}
        onVerifyPin={verifyPin}
      />
    </Frame>
  );
}
export function AdminModeracaoClaro() {
  return <ModerationDemo theme="light" detail={false} />;
}
export function AdminModeracaoEscuro() {
  return <ModerationDemo theme="dark" detail={false} />;
}
export function AdminModeracaoDrawerClaro() {
  return <ModerationDemo theme="light" detail />;
}
export function AdminModeracaoDrawerEscuro() {
  return <ModerationDemo theme="dark" detail />;
}

function LeadsDemo({ theme, detail }: { theme: "light" | "dark"; detail: boolean }) {
  return (
    <Frame theme={theme} activeId="siteLeads">
      <LeadsManager
        rows={leadRows}
        filters={leadFilters}
        staff={[
          { id: "cc000000-0000-4000-8000-000000000002", full_name: "Helena Matos" },
          { id: "cc000000-0000-4000-8000-000000000003", full_name: "Miguel Santos" },
        ]}
        pageInfo={{
          page: 1,
          pageCount: 2,
          hasNext: true,
          hasPrevious: false,
          firstCursor: { createdAt: leadRows[0]!.created_at, id: leadRows[0]!.id },
          lastCursor: { createdAt: leadRows[1]!.created_at, id: leadRows[1]!.id },
        }}
        selected={detail ? selectedLead : null}
        history={detail ? leadHistory : []}
        detailError={false}
        loadError={false}
        locale="pt"
        onUpdate={stubResult}
        onAddNote={stubResult}
        onExport={async () => ({ ok: true, csv: "" })}
        onVerifyPin={verifyPin}
      />
    </Frame>
  );
}
export function AdminLeadsClaro() {
  return <LeadsDemo theme="light" detail={false} />;
}
export function AdminLeadsEscuro() {
  return <LeadsDemo theme="dark" detail={false} />;
}
export function AdminLeadDrawerClaro() {
  return <LeadsDemo theme="light" detail />;
}
export function AdminLeadDrawerEscuro() {
  return <LeadsDemo theme="dark" detail />;
}

const settingsFixture = [
  {
    key: "company_name",
    value: "UProperty Market, Lda." as Json,
    description: "Nome legal da empresa",
    public: true,
  },
  { key: "company_tax_id", value: "516 000 000" as Json, description: "NIF", public: true },
  {
    key: "company_address",
    value: "Avenida da República, Lisboa" as Json,
    description: "Morada",
    public: true,
  },
  {
    key: "company_phone",
    value: "+351 210 000 000" as Json,
    description: "Telefone",
    public: true,
  },
  {
    key: "company_email",
    value: "ola@uproperty.example" as Json,
    description: "E-mail",
    public: true,
  },
  {
    key: "billing_email",
    value: "faturacao@uproperty.example" as Json,
    description: "Faturação",
    public: true,
  },
];
const flagsFixture = [
  { key: "launch_mode", value: "pre" as Json, description: "Modo do site público" },
  {
    key: "interno_ip_allowlist",
    value: ["192.0.2.0/24", "198.51.100.10"] as Json,
    description: "Redes autorizadas",
  },
];
function SettingsDemo({ theme }: { theme: "light" | "dark" }) {
  return (
    <Frame theme={theme} activeId="settings">
      <SettingsManager
        flags={flagsFixture}
        settings={settingsFixture}
        integrations={{ stripe: true, supabase: true, maptiler: false, analytics: false }}
        loadError={false}
        onSaveFlag={stubResult}
        onSaveSetting={stubResult}
        onVerifyPin={verifyPin}
      />
    </Frame>
  );
}
export function AdminDefinicoesClaro() {
  return <SettingsDemo theme="light" />;
}
export function AdminDefinicoesEscuro() {
  return <SettingsDemo theme="dark" />;
}

export { AdminPainelClaro as AdminDashboardClaro, AdminPainelEscuro as AdminDashboardEscuro };
