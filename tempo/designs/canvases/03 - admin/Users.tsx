import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import { ToastProvider } from "../../../../packages/ui/src/components/Toast";
import { InternalChrome } from "../../../../apps/interno/src/components/InternalChrome";
import "../../_estilos/shell-no-canvas.css";
import {
  UsersManager,
  type UserDetail,
  type UserDirectoryRow,
} from "../../../../apps/interno/src/app/admin/utilizadores/UsersManager";
import type { VerifyPinAction } from "../../../../apps/interno/src/components/stepUpTypes";
import ptMessages from "../../../../packages/config/messages/pt.json";

const users: UserDirectoryRow[] = [
  {
    id: "ccaa0000-0000-4000-8000-000000000001",
    full_name: "Marta Oliveira",
    email: "marta.oliveira@example.pt",
    role: "owner",
    status: "active",
    plan_name: "Smarter",
    plan_slug: "smarter-owner",
    subscription_status: "active",
    trial_ends_at: null,
    created_at: "2026-09-28T09:15:00.000Z",
  },
  {
    id: "ccaa0000-0000-4000-8000-000000000002",
    full_name: "João Mendes",
    email: "joao.mendes@example.pt",
    role: "buyer",
    status: "active",
    plan_name: "Gratuito",
    plan_slug: "gratuito-buyer",
    subscription_status: null,
    trial_ends_at: null,
    created_at: "2026-09-27T12:30:00.000Z",
  },
  {
    id: "ccaa0000-0000-4000-8000-000000000003",
    full_name: "Inês Carvalho",
    email: "ines.carvalho@example.pt",
    role: "owner",
    status: "pending",
    plan_name: "Essential",
    plan_slug: "essential-owner",
    subscription_status: null,
    trial_ends_at: null,
    created_at: "2026-09-26T16:45:00.000Z",
  },
  {
    id: "ccaa0000-0000-4000-8000-000000000004",
    full_name: "Rui Costa",
    email: "rui.costa@example.pt",
    role: "buyer",
    status: "suspended",
    plan_name: "Smarter",
    plan_slug: "smarter-buyer",
    subscription_status: "canceled",
    trial_ends_at: null,
    created_at: "2026-09-25T08:10:00.000Z",
  },
  {
    id: "ccaa0000-0000-4000-8000-000000000005",
    full_name: "Sofia Martins",
    email: "sofia.martins@example.pt",
    role: "owner",
    status: "active",
    plan_name: "Premium",
    plan_slug: "premium-owner",
    subscription_status: "trialing",
    trial_ends_at: "2026-10-05T10:00:00.000Z",
    created_at: "2026-09-24T14:20:00.000Z",
  },
];

const selectedProfile = {
  ...users[0]!,
  updated_at: "2026-10-01T10:15:00.000Z",
  current_period_end: "2026-10-28T09:15:00.000Z",
} satisfies UserDetail;

const verifyPin: VerifyPinAction = async () => ({ ok: true });
const onChangeStatus = async () => ({ ok: true });

function UsersDemo({ theme, detail = false }: { theme: "light" | "dark"; detail?: boolean }) {
  const cursor = {
    createdAt: users[users.length - 1]!.created_at,
    id: users[users.length - 1]!.id,
  };

  return (
    // `data-upm-overlay-root`: o drawer do detalhe nasce aqui dentro e não no
    // `body` — ver a nota de `usePortalTarget` em `packages/ui`.
    <div
      data-theme={theme}
      data-upm-overlay-root
      style={{ minHeight: "1050px", background: "var(--bg)" }}
    >
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <ThemeProvider initialChoice={theme}>
          <ToastProvider>
            <InternalChrome
              role="admin"
              userName="Helena Matos"
              userMeta="Administração"
              activeId="users"
              locale="pt"
              onLocaleChange={async () => undefined}
              counters={{ propertyModeration: 4, siteLeads: 12 }}
            >
              <UsersManager
                users={users}
                plans={[
                  { id: "plan-essential", name: "Essential" },
                  { id: "plan-smarter", name: "Smarter" },
                  { id: "plan-premium", name: "Premium" },
                ]}
                filters={{ search: "", role: "", status: "", planId: "" }}
                pageInfo={{
                  page: 1,
                  pageCount: 3,
                  hasNext: true,
                  hasPrevious: false,
                  firstCursor: { createdAt: users[0]!.created_at, id: users[0]!.id },
                  lastCursor: cursor,
                }}
                selectedProfile={detail ? selectedProfile : null}
                selectedProfileError={false}
                loadError={false}
                locale="pt"
                currentAdminId="ccaa0000-0000-4000-8000-000000000099"
                onChangeStatus={onChangeStatus}
                onLogAccess={async () => undefined}
                onVerifyPin={verifyPin}
              />
            </InternalChrome>
          </ToastProvider>
        </ThemeProvider>
      </NextIntlClientProvider>
    </div>
  );
}

export function AdminUtilizadoresClaro() {
  return <UsersDemo theme="light" />;
}

export function AdminUtilizadoresEscuro() {
  return <UsersDemo theme="dark" />;
}

export function AdminUtilizadorDrawerClaro() {
  return <UsersDemo theme="light" detail />;
}

export function AdminUtilizadorDrawerEscuro() {
  return <UsersDemo theme="dark" detail />;
}
