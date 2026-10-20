import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import { ToastProvider } from "../../../../packages/ui/src/components/Toast";
import { InternalChrome } from "../../../../apps/interno/src/components/InternalChrome";
import { StaffCloud } from "../../../../apps/interno/src/components/StaffCloud";
import ptMessages from "../../../../packages/config/messages/pt.json";
import { STAFF_FILES, STAFF_FOLDERS } from "../../_fixtures/marketing";

/**
 * Cloud interna — `/marketing/cloud` (P10-10 · 07 §24.6)
 * =========================================================================
 * Última entrada do `MARKETING_NAV` com rota a existir. É a **mesma gaveta** de
 * `/suporte/cloud`, pela porta do Marketing: o `StaffCloud` é um só, e é por
 * isso que esta storyboard mostra a área do marketing e não uma segunda Cloud.
 *
 * A razão de a rota existir está em `20261015180000`: até lá as políticas de
 * `scope = 'staff'` diziam `is_staff()`, que por decisão de 07 §24.6 **não**
 * inclui o marketing — esta página abriria vazia e a do Suporte ao lado cheia,
 * sobre as mesmas linhas.
 *
 * **D71 vive aqui.** Este `StaffCloud` é deliberadamente mais magro do que o
 * `CloudScreen` do cliente (sem partilhas — na gaveta da equipa o `scope` É a
 * partilha —, sem quota e sem subpastas), e a dívida que o explica é a
 * impossibilidade de reutilizar o ecrã do cliente enquanto ele tinha 40 frases
 * em português escritas à mão. Com D72 a fechar, é este o ecrã que desaparece.
 *
 * Dois estados: com ficheiros (incluindo um na reciclagem, que é o que a vista
 * "Reciclagem" existe para mostrar) e a gaveta vazia, que é o primeiro dia.
 * Nada escreve: carregar, apagar e repor devolvem `{}`.
 */

const semEscrita = async () => ({});

function CloudDemo({
  theme,
  files,
  folders,
}: {
  theme: "light" | "dark";
  files: typeof STAFF_FILES;
  folders: typeof STAFF_FOLDERS;
}) {
  return (
    <div data-theme={theme} style={{ minHeight: "900px", background: "var(--bg)" }}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <ThemeProvider initialChoice={theme}>
          <ToastProvider>
            <InternalChrome
              role="marketing"
              userName="Marta Nunes"
              userMeta="Marketing · Comunicação"
              activeId="internalCloud"
              locale="pt"
              onLocaleChange={async () => undefined}
            >
              <StaffCloud
                folders={folders}
                files={files}
                locale="pt"
                onUpload={semEscrita}
                onCreateFolder={semEscrita}
                onDelete={semEscrita}
                onRestore={semEscrita}
                onDownloadUrl={semEscrita}
              />
            </InternalChrome>
          </ToastProvider>
        </ThemeProvider>
      </NextIntlClientProvider>
    </div>
  );
}

export function MarketingCloudClaro() {
  return <CloudDemo theme="light" files={STAFF_FILES} folders={STAFF_FOLDERS} />;
}

export function MarketingCloudEscuro() {
  return <CloudDemo theme="dark" files={STAFF_FILES} folders={STAFF_FOLDERS} />;
}

/** O primeiro dia da gaveta da equipa. */
export function MarketingCloudVazia() {
  return <CloudDemo theme="light" files={[]} folders={[]} />;
}

export function MarketingCloudVaziaEscuro() {
  return <CloudDemo theme="dark" files={[]} folders={[]} />;
}
