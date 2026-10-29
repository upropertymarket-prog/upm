import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import { ToastProvider } from "../../../../packages/ui/src/components/Toast";
import { InternalChrome } from "../../../../apps/interno/src/components/InternalChrome";
import "../../_estilos/shell-no-canvas.css";
import ptMessages from "../../../../packages/config/messages/pt.json";
import {
  MailboxManager,
  type MailboxRow,
  type StaffOption,
} from "../../../../apps/interno/src/app/admin/caixas-email/MailboxManager";

/**
 * Configuração de e-mail — `/admin/caixas-email` (P10-03 · 04 §2.5)
 * =========================================================================
 * **É o componente real**, como todas as outras storyboards deste canvas. O que
 * muda é só o que vem por prop: as linhas são inventadas e as três ações
 * (`onSave`, `onSaveSecret`, `onTest`) são becos sem saída.
 *
 * **Nenhuma storyboard escreve na base de dados**, e aqui a regra vale a dobrar:
 * `onSaveSecret` é a porta da credencial. Uma storyboard que a deixasse chegar
 * ao `save_mailbox_secret` seria um segundo caminho de escrita para o Vault a
 * partir do canvas, sem o `is_admin()` do ecrã real.
 *
 * ## Porque são três estados e não um
 *
 * O ecrã passa a vida em três situações muito diferentes, e só a primeira é a
 * que se vê hoje:
 *
 *  - **Vazio** — nenhuma caixa criada. É literalmente o ecrã que recebe quem
 *    volta a isto depois de criar as caixas na Amen, e por isso é o mais
 *    importante de rever: se este estado não disser o passo seguinte, ninguém
 *    percebe o que fazer a seguir.
 *  - **Com caixas** — três linhas que cobrem a coluna "Credencial" nos seus
 *    dois valores e a de "Estado" nos três. Com todas iguais, as colunas que
 *    mais importam neste ecrã não se reviam.
 *  - **Drawer aberto** — não dá para o mostrar daqui sem abrir o `Drawer` por
 *    fora do componente, que seria mexer-lhe no estado interno. Fica por fazer,
 *    e é a razão de não haver uma quarta moldura: a alternativa era uma cópia
 *    do formulário, e uma cópia diverge do produto à primeira alteração.
 *
 * `lastError` entra numa linha de propósito — é texto que vem do servidor de
 * correio, de comprimento imprevisível, e é onde a coluna "Estado" parte
 * primeiro se não tiver sido pensada.
 */

const STAFF: StaffOption[] = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Helena Matos" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Rui Esteves" },
];

const ROWS: MailboxRow[] = [
  {
    id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
    address: "suporte@upropertymarket.pt",
    displayName: "Suporte UProperty",
    protocol: "imap",
    inHost: "imap.amen.pt",
    inPort: 993,
    inSecurity: "ssl_tls",
    smtpHost: "smtp.amen.pt",
    smtpPort: 587,
    smtpSecurity: "starttls",
    username: "suporte@upropertymarket.pt",
    department: "suporte",
    ownerProfileId: STAFF[0].id,
    status: "active",
    hasSecret: true,
    lastSyncAt: "2026-10-13T13:40:00.000Z",
    lastError: null,
  },
  {
    // Criada e por configurar: o estado em que uma caixa fica entre o "Criar
    // caixa" e a gravação da palavra-passe.
    id: "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb",
    address: "geral@upropertymarket.pt",
    displayName: "Geral",
    protocol: "imap",
    inHost: "imap.amen.pt",
    inPort: 993,
    inSecurity: "ssl_tls",
    smtpHost: "smtp.amen.pt",
    smtpPort: 587,
    smtpSecurity: "starttls",
    username: "geral@upropertymarket.pt",
    department: "admin",
    ownerProfileId: null,
    status: "paused",
    hasSecret: false,
    lastSyncAt: null,
    lastError: null,
  },
  {
    id: "cccccccc-3333-4333-8333-cccccccccccc",
    address: "faturacao@upropertymarket.pt",
    displayName: "Faturação",
    protocol: "pop3",
    inHost: "pop.amen.pt",
    inPort: 995,
    inSecurity: "ssl_tls",
    smtpHost: "smtp.amen.pt",
    smtpPort: 465,
    smtpSecurity: "ssl_tls",
    username: "faturacao@upropertymarket.pt",
    department: "financeiro",
    ownerProfileId: STAFF[1].id,
    status: "error",
    hasSecret: true,
    lastSyncAt: "2026-10-11T07:15:00.000Z",
    // Mensagem real de um servidor IMAP, com o comprimento que costumam ter.
    lastError: "AUTHENTICATIONFAILED: Invalid credentials (Failure)",
  },
];

/** Ver a nota de topo: as três ações não chegam a lado nenhum. */
const semEscrita = async () => ({});

function AdminMailboxesDemo({ theme, rows }: { theme: "light" | "dark"; rows: MailboxRow[] }) {
  return (
    <div data-theme={theme} style={{ minHeight: "900px", background: "var(--bg)" }}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <ThemeProvider initialChoice={theme}>
          <ToastProvider>
            <InternalChrome
              role="admin"
              userName="Helena Matos"
              userMeta="Administração · IT"
              activeId="mailboxes"
              locale="pt"
              onLocaleChange={async () => undefined}
              counters={{ propertyModeration: 4, siteLeads: 12 }}
            >
              <MailboxManager
                rows={rows}
                staff={STAFF}
                loadError={false}
                onSave={semEscrita}
                onSaveSecret={semEscrita}
                onTest={semEscrita}
              />
            </InternalChrome>
          </ToastProvider>
        </ThemeProvider>
      </NextIntlClientProvider>
    </div>
  );
}

export function AdminCaixasEmailClaro() {
  return <AdminMailboxesDemo theme="light" rows={ROWS} />;
}

export function AdminCaixasEmailEscuro() {
  return <AdminMailboxesDemo theme="dark" rows={ROWS} />;
}

/** O ecrã de quem volta a isto depois de criar as caixas na Amen. */
export function AdminCaixasEmailVazio() {
  return <AdminMailboxesDemo theme="light" rows={[]} />;
}

export function AdminCaixasEmailVazioEscuro() {
  return <AdminMailboxesDemo theme="dark" rows={[]} />;
}
