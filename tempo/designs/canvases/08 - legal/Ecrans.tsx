import { NextIntlClientProvider } from "next-intl";

import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import { LegalDocumentView } from "../../../../apps/web/src/components/legal/LegalDocumentView";
import { PublicHeader } from "../../../../apps/web/src/components/PublicHeader";
import { SiteFooter } from "../../../../apps/web/src/components/site/SiteFooter";
import ptMessages from "../../../../packages/config/messages/pt.json";
import { COOKIES, PRIVACIDADE, TERMOS, VERSOES } from "./conteudo.generated";

/**
 * Páginas legais — claro e escuro, com o texto REAL.
 * =========================================================================
 * Saíram do canvas de Autenticação a 6 out 2026: não são ecrãs de auth, são os
 * documentos que a caixa de aceitação e o rodapé abrem.
 *
 * **A vista é a real e o conteúdo também.** `LegalDocumentView` é o mesmo
 * componente que as três `page.tsx` usam, e o corpo vem de
 * `conteudo.generated.ts`, extraído das próprias migrações por
 * `scripts/extract-legal-drafts.mjs`. Até 7 out 2026 estavam aqui excertos
 * escritos à mão — e um excerto escrito à mão é uma segunda cópia de um
 * contrato, que diverge à primeira cláusula alterada. Agora só diverge se
 * alguém esquecer de correr o script, e isso vê-se na versão em cima da página.
 *
 * O que continua a ser de demonstração é só a origem dos dados: a página real
 * lê `legal_documents` com `currentLegalDocument()`, e `LegalDocumentPage` é
 * `async` e usa `next/headers` — nada disso corre numa storyboard.
 *
 * Proteção de Dados continua de fora: é a única das quatro que ainda não tem
 * rota. Entra quando P11-07 a criar.
 *
 * As molduras são 1440 × 900, como em todos os outros canvases: o documento rola
 * dentro delas, como rola num browser. O `index.canvas.tsx` explica porque é que
 * o `intrinsicSizing` foi tentado e revertido.
 *
 * **12 out 2026 — os três ecrãs passaram a ter a barra e o rodapé do site.** O
 * cliente olhou para as storyboards e disse o óbvio: não se revê como vai ficar
 * uma página do `www` sem o menu e o rodapé com que o visitante a vê. O que se
 * corrigiu primeiro foi a **app** — `LegalDocumentPage` servia o documento
 * sozinho —, e estes ecrãs limitam-se a mostrar o que a rota passou a fazer. Se
 * só a storyboard tivesse mudado, estaria a mostrar uma página que não existe.
 *
 * O tema fixa-se num `data-theme` à volta de cada ecrã, **não** no
 * `documentElement`: as storyboards partilham o documento do host, por isso
 * escrever na raiz faz a última a renderizar arrastar as outras todas.
 *
 * **O `ThemeProvider` entrou com o cabeçalho**, e só por causa dele: o
 * `PublicHeader` tem o `ThemeToggle`, que chama `useTheme()` e rebenta sem
 * provider. A ordem é a que o canvas `site-publico` já tinha encontrado —
 * **provider por fora, `data-theme` por dentro** —, porque o atributo mais
 * próximo é o que os tokens resolvem, e assim cada storyboard mantém o seu tema
 * mesmo com o provider a escrever outro na raiz.
 *
 * O wrapper pinta `bg-bg` e garante `min-h-screen` porque a `page.tsx` real não
 * o faz: na app é o `<body>` que dá o fundo, e dentro de uma storyboard não há
 * `<body>` próprio. Sem isto o fundo do canvas atravessa as storyboards claras e
 * o texto escuro fica ilegível.
 */

/**
 * A linha de versão é por documento, não partilhada: desde 7 out 2026 a
 * Privacidade está em `draft3` (o marketing passou a assentar em interesse
 * legítimo) e as outras duas continuam em `draft2`. Uma constante única punha a
 * mesma versão nos três e mentia em dois.
 */
const linhaVersao = (versao: string) => `Versão ${versao} · em vigor desde 07/10/2026`;

function Ecra({ theme, children }: { theme: "light" | "dark"; children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ThemeProvider initialChoice={theme}>
        <div data-theme={theme} data-app="web" className="min-h-screen bg-bg text-text">
          {children}
        </div>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}

/** Trocar o idioma dentro de uma storyboard não leva a lado nenhum. */
const semEfeito = () => undefined;

function Documento({
  theme,
  title,
  markdown,
  versao,
}: {
  theme: "light" | "dark";
  title: string;
  markdown: string;
  versao: string;
}) {
  return (
    <Ecra theme={theme}>
      {/* `launchMode="pre"` porque é o modo em que o site está hoje, faixa
          incluída: é essa a página que alguém abre agora a partir da caixa de
          aceitação ou do rodapé. Em `post` muda a faixa (desaparece) e o CTA
          (`Criar conta`), e isso já se revê nas storyboards do site público. */}
      <PublicHeader locale="pt" onLocaleChange={semEfeito} launchMode="pre" />
      <LegalDocumentView title={title} versionLine={linhaVersao(versao)} markdown={markdown} />
      <SiteFooter />
    </Ecra>
  );
}

const TITULO_TERMOS = "Termos e Condições de Utilização — UProperty Market";
const TITULO_PRIVACIDADE = "Política de Privacidade — UProperty Market";
const TITULO_COOKIES = "Política de Cookies — UProperty Market";

export const TermosClaro = () => (
  <Documento theme="light" title={TITULO_TERMOS} markdown={TERMOS} versao={VERSOES.TERMOS} />
);
export const TermosEscuro = () => (
  <Documento theme="dark" title={TITULO_TERMOS} markdown={TERMOS} versao={VERSOES.TERMOS} />
);

export const PrivacidadeClaro = () => (
  <Documento
    theme="light"
    title={TITULO_PRIVACIDADE}
    markdown={PRIVACIDADE}
    versao={VERSOES.PRIVACIDADE}
  />
);
export const PrivacidadeEscuro = () => (
  <Documento
    theme="dark"
    title={TITULO_PRIVACIDADE}
    markdown={PRIVACIDADE}
    versao={VERSOES.PRIVACIDADE}
  />
);

export const CookiesClaro = () => (
  <Documento theme="light" title={TITULO_COOKIES} markdown={COOKIES} versao={VERSOES.COOKIES} />
);
export const CookiesEscuro = () => (
  <Documento theme="dark" title={TITULO_COOKIES} markdown={COOKIES} versao={VERSOES.COOKIES} />
);
