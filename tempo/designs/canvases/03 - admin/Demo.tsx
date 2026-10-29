import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import { ToastProvider } from "../../../../packages/ui/src/components/Toast";
import { InternalChrome } from "../../../../apps/interno/src/components/InternalChrome";
import "../../_estilos/shell-no-canvas.css";
import ptMessages from "../../../../packages/config/messages/pt.json";
import {
  TemplateManager,
  type TemplateManagerActions,
} from "../../../../apps/interno/src/app/admin/contratos/TemplateManager";

const body = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Pelo presente contrato, o proprietário e o comprador acordam os termos seguintes.",
        },
      ],
    },
  ],
};

const templates = [
  {
    id: "sale-template",
    family_id: "sale-family",
    name: "Contrato de compra e venda",
    kind: "sale" as const,
    version: 3,
    status: "published" as const,
    body,
    variables: ["proprietario", "comprador", "imovel", "preco", "data"],
    updated_at: "2026-09-30T10:30:00.000Z",
  },
  {
    id: "rent-template",
    family_id: "rent-family",
    name: "Contrato de arrendamento",
    kind: "rent" as const,
    version: 2,
    status: "draft" as const,
    body,
    variables: ["proprietario", "inquilino", "morada", "renda", "prazo"],
    updated_at: "2026-09-29T15:00:00.000Z",
  },
];
const actions: TemplateManagerActions = {
  createTemplate: async () => ({ ok: true }),
  saveTemplate: async () => ({ ok: true }),
  startTemplateVersion: async (familyId) => ({ ok: true, id: familyId }),
  publishTemplate: async () => ({ ok: true }),
};

function AdminContractsDemo({ theme }: { theme: "light" | "dark" }) {
  return (
    <div data-theme={theme} style={{ minHeight: "900px", background: "var(--bg)" }}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <ThemeProvider initialChoice={theme}>
          <ToastProvider>
            <InternalChrome
              role="admin"
              userName="Helena Matos"
              userMeta="Administração · IT"
              activeId="contractTemplates"
              locale="pt"
              onLocaleChange={async () => undefined}
              counters={{ propertyModeration: 4, siteLeads: 12 }}
            >
              <TemplateManager templates={templates} actions={actions} />
            </InternalChrome>
          </ToastProvider>
        </ThemeProvider>
      </NextIntlClientProvider>
    </div>
  );
}

export function AdminContratosClaro() {
  return <AdminContractsDemo theme="light" />;
}
export function AdminContratosEscuro() {
  return <AdminContractsDemo theme="dark" />;
}
