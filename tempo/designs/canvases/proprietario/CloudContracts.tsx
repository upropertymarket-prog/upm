import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import { ToastProvider } from "../../../../packages/ui/src/components/Toast";
import { PageHeader } from "../../../../packages/ui/src/shell/PageHeader";
import { AppChrome } from "../../../../apps/app/src/components/AppChrome";
import { CloudScreen } from "../../../../apps/app/src/components/cloud/CloudScreen";
import { ContractsScreen } from "../../../../apps/app/src/components/contracts/ContractsScreen";
import type {
  CloudFileRow,
  FolderNode,
  ShareContact,
  SharedWithMeRow,
} from "../../../../apps/app/src/components/cloud/cloudTypes";
import type {
  ContractRow,
  ContractSharedWithMeRow,
  TemplateRow,
} from "../../../../apps/app/src/components/contracts/contractTypes";
import ptMessages from "../../../../packages/config/messages/pt.json";

const folders: FolderNode[] = [
  {
    id: "personal",
    parentId: null,
    name: "Os meus ficheiros",
    kind: "user",
    propertyId: null,
    fileCount: 2,
    children: [],
  },
  {
    id: "property",
    parentId: null,
    name: "Apartamento · UPM-1041",
    kind: "property",
    propertyId: "property-1",
    fileCount: 3,
    children: [
      {
        id: "documents",
        parentId: "property",
        name: "Documentos do imóvel",
        kind: "property_documents",
        propertyId: "property-1",
        fileCount: 2,
        children: [],
      },
    ],
  },
];
const files: CloudFileRow[] = [
  {
    id: "file-1",
    folderId: "personal",
    name: "Caderneta predial.pdf",
    mime: "application/pdf",
    size: 2180000,
    source: "upload",
    currentVersion: 3,
    readonly: false,
    sharedLabel: "Só para si",
    shareCount: 0,
    hasLink: false,
    createdAt: "2026-09-29T10:00:00.000Z",
    deletedAt: null,
  },
  {
    id: "file-2",
    folderId: "documents",
    name: "Planta.pdf",
    mime: "application/pdf",
    size: 860000,
    source: "property_document",
    currentVersion: 1,
    readonly: true,
    sharedLabel: "Com 2 pessoas",
    shareCount: 2,
    hasLink: false,
    createdAt: "2026-09-28T10:00:00.000Z",
    deletedAt: null,
  },
  {
    id: "file-3",
    folderId: "personal",
    name: "Fotografia-sala.jpg",
    mime: "image/jpeg",
    size: 4200000,
    source: "upload",
    currentVersion: 1,
    readonly: false,
    sharedLabel: "Só para si",
    shareCount: 0,
    hasLink: false,
    createdAt: "2026-09-25T10:00:00.000Z",
    deletedAt: null,
  },
];
const sharedWithMe: SharedWithMeRow[] = [
  {
    fileId: "file-4",
    shareId: "share-4",
    name: "Ficha do imóvel.pdf",
    mime: "application/pdf",
    size: 1200000,
    permission: "view",
    sharedByName: "João Costa",
    expiresAt: null,
    createdAt: "2026-09-27T10:00:00.000Z",
  },
];
const contacts: ShareContact[] = [
  { id: "person-1", name: "João Costa" },
  { id: "person-2", name: "Helena Matos" },
];
const noop = async () => ({});
const details = async () => ({ versions: [], accesses: [], shares: [] });
const templates: TemplateRow[] = [
  {
    id: "template-sale",
    familyId: "family-sale",
    kind: "sale",
    name: "Contrato de compra e venda",
    version: 3,
    variables: ["proprietario", "comprador", "imovel", "preco", "data"],
  },
  {
    id: "template-rent",
    familyId: "family-rent",
    kind: "rent",
    name: "Contrato de arrendamento",
    version: 2,
    variables: ["proprietario", "inquilino", "morada", "renda", "prazo"],
  },
];
const contracts: ContractRow[] = [
  {
    id: "contract-1",
    title: "Compra e venda · UPM-1041",
    kind: "sale",
    status: "shared",
    propertyId: "property-1",
    propertyTitle: "Apartamento em Lisboa",
    counterpartyName: "João Costa",
    currentVersion: 3,
    shareCount: 1,
    sharedAt: "2026-09-29T10:00:00.000Z",
    updatedAt: "2026-09-30T10:00:00.000Z",
  },
];
const sharedContracts: ContractSharedWithMeRow[] = [
  {
    contractId: "contract-2",
    shareId: "share-2",
    title: "Arrendamento · Rua do Sol",
    kind: "rent",
    status: "awaiting_signature",
    body: { type: "doc", content: [] },
    values: {},
    permission: "view",
    sharedByName: "João Costa",
    expiresAt: null,
    sharedAt: "2026-09-28T10:00:00.000Z",
  },
];

function Shell({
  theme,
  activeId,
  children,
}: {
  theme: "light" | "dark";
  activeId: "cloud" | "contracts";
  children: React.ReactNode;
}) {
  return (
    <div data-theme={theme} style={{ minHeight: "900px", background: "var(--bg)" }}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <ThemeProvider initialChoice={theme}>
          <ToastProvider>
            <AppChrome
              role="owner"
              userName="Ana Silva"
              userMeta="Proprietária · Premium"
              activeId={activeId}
              locale="pt"
              onLocaleChange={async () => undefined}
              counters={{ leads: 9, messages: 3, visitSchedule: 3, contracts: 1 }}
              notifications={[]}
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
function CloudDemo({ theme }: { theme: "light" | "dark" }) {
  return (
    <Shell theme={theme} activeId="cloud">
      <CloudScreen
        subtitle="2,1 GB de 5 GB usados"
        status={{
          hasCloud: true,
          usedBytes: 2100000000,
          limitBytes: 5000000000,
          nearPlanLimit: false,
        }}
        folders={folders}
        files={files}
        sharedWithMe={sharedWithMe}
        contacts={contacts}
        onCreateFolder={noop}
        onDeleteFolder={noop}
        onUpload={noop}
        onReplace={noop}
        onDelete={noop}
        onEmptyRecycleBin={noop}
        onDownloadUrl={async () => ({ url: "#" })}
        onShare={async () => ({ ok: true })}
        onRevokeShare={noop}
        onLoadDetails={details}
        onRestoreVersion={noop}
      />
    </Shell>
  );
}
function ContractsDemo({ theme }: { theme: "light" | "dark" }) {
  return (
    <Shell theme={theme} activeId="contracts">
      <PageHeader title="Contratos" subtitle="1 contrato por fechar" />
      <ContractsScreen
        contracts={contracts}
        templates={templates}
        sharedWithMe={sharedContracts}
        properties={[{ id: "property-1", title: "Apartamento em Lisboa" }]}
        canCreate
        onCreate={async () => ({ id: "contract-new" })}
      />
    </Shell>
  );
}
export function CloudClaro() {
  return <CloudDemo theme="light" />;
}
export function CloudEscuro() {
  return <CloudDemo theme="dark" />;
}
export function ContratosClaro() {
  return <ContractsDemo theme="light" />;
}
export function ContratosEscuro() {
  return <ContractsDemo theme="dark" />;
}
