import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import { ToastProvider } from "../../../../packages/ui/src/components/Toast";
import { InternalChrome } from "../../../../apps/interno/src/components/InternalChrome";
import { CloudScreen } from "../../../../packages/cloud/src/CloudScreen";
import { staffCloudStatus } from "../../../../packages/db/src/cloud";
import ptMessages from "../../../../packages/config/messages/pt.json";
import { STAFF_FILES, STAFF_FOLDERS } from "../../_fixtures/marketing";

/**
 * Cloud interna — `/marketing/cloud` (P10-10 · 07 §24.6 · D71)
 * =========================================================================
 * Última entrada do `MARKETING_NAV` com rota a existir. É a **mesma gaveta** de
 * `/suporte/cloud`, pela porta do Marketing: o ecrã é um só, e é por isso que
 * esta storyboard mostra a área do marketing e não uma segunda Cloud.
 *
 * A razão de a rota existir está em `20261015180000`: até lá as políticas de
 * `scope = 'staff'` diziam `is_staff()`, que por decisão de 07 §24.6 **não**
 * inclui o marketing — esta página abriria vazia e a do Suporte ao lado cheia,
 * sobre as mesmas linhas.
 *
 * **D71 fechou a 26 out 2026, e vê-se aqui.** Havia um `StaffCloud` próprio,
 * mais magro, porque o `CloudScreen` do cliente tinha ~200 frases em português
 * escritas à mão e não podia entrar num painel bilingue. D72 traduziu-o, e as
 * duas Clouds passaram a ser a mesma: esta storyboard monta o `CloudScreen` de
 * `@upm/cloud`, sem as capacidades que esta gaveta não tem — sem partilhas
 * (`scope = 'staff'` **é** a partilha) e com `onRestore`, que é o que a
 * reciclagem da equipa sabe fazer e a do cliente não.
 *
 * O cartão de armazenamento aparece, com o tecto de exemplo de
 * `STAFF_CLOUD_LIMIT_BYTES`: a Cloud da equipa não se cobra a ninguém — o custo
 * é da empresa (26 out 2026) — e o número existe para a equipa ver o que ocupa
 * e saber quando pedir mais, não para recusar um upload.
 *
 * **Uma storyboard, três portas.** `/admin/cloud` e `/suporte/cloud` mostram
 * este mesmo ecrã; o que muda é o menu à esquerda. Revê-se aqui, pela porta do
 * Marketing, porque é o ecrã que se revê e não a moldura.
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
              <CloudScreen
                title={ptMessages.internalCloud.title}
                subtitle={ptMessages.internalCloud.subtitle}
                /* O mesmo tecto de exemplo da produção, e vindo da mesma
                   constante: um número escrito à mão aqui divergia no dia em
                   que o limite subisse, e a storyboard passava a rever um
                   cartão que já não é o que se vê. */
                status={staffCloudStatus(files.reduce((total, file) => total + file.size, 0))}
                folders={folders}
                files={files}
                canNestFolders={false}
                onCreateFolder={semEscrita}
                onUpload={semEscrita}
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
