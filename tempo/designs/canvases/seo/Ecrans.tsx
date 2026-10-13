import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import { ToastProvider } from "../../../../packages/ui/src/components/Toast";
import { SeoManager, type SeoPageRow } from "../../../../apps/interno/src/app/admin/seo/SeoManager";
import ptMessages from "../../../../packages/config/messages/pt.json";

import { seo as seoHome } from "../../../../apps/web/src/app/seo";
import { seo as seoCookies } from "../../../../apps/web/src/app/cookies/seo";
import { seo as seoCriarConta } from "../../../../apps/web/src/app/criar-conta/seo";
import { seo as seoVerificacao } from "../../../../apps/web/src/app/criar-conta/verificacao/seo";
import { seo as seoEntrar } from "../../../../apps/web/src/app/entrar/seo";
import { seo as seoImoveis } from "../../../../apps/web/src/app/imoveis/seo";
import { seo as seoImovel } from "../../../../apps/web/src/app/imoveis/[slug]/seo";
import { seo as seoPreInscricao } from "../../../../apps/web/src/app/pre-inscricao/seo";
import { seo as seoPrivacidade } from "../../../../apps/web/src/app/privacidade/seo";
import { seo as seoRecuperar } from "../../../../apps/web/src/app/recuperar-palavra-passe/seo";
import { seo as seoConfirmar } from "../../../../apps/web/src/app/recuperar-palavra-passe/confirmar/seo";
import { seo as seoTermos } from "../../../../apps/web/src/app/termos/seo";

/**
 * SEO por rota pública — uma storyboard por rota (P2-06 · 07, 7 out 2026)
 * =========================================================================
 * **Porque é que este canvas existe, e porque não são Route Storyboards.**
 * 04 §2.1.1 e §2.1.2 mandavam pôr isto em `apps/web/src/tempobook/storyboards/`
 * como Route Storyboards. A 7 out 2026, depois de verificar o repositório,
 * 07 registou que esse caminho **não existe neste projeto**: não há pasta
 * `tempobook` e não há uma única Route Storyboard — zero `route:` em todos os
 * canvases. As duas secções foram escritas antes de os canvases serem
 * construídos e descrevem uma convenção que o projeto nunca seguiu.
 *
 * A storyboard não foi cancelada, foi **traduzida**: um canvas `seo` com uma
 * storyboard por rota pública, cada uma a importar o `seo.ts` da sua rota.
 * Cumpre o "uma storyboard por rota" sem inventar um mecanismo que este
 * repositório não usa — e sem depender da D9, que é o que bloqueava as Route
 * Storyboards de verdade (as apps não têm o plugin de anotação do Tempo nos
 * seus `next.config.ts`, por isso os elementos não seriam selecionáveis).
 *
 * ## O que cada storyboard mostra
 *
 * O `SeoManager` real do Admin, com **uma linha só** — a da sua rota. Não é um
 * editor próprio: 07 recusou explicitamente "um editor próprio ligado à mesma
 * tabela e às mesmas server actions", que seria um segundo editor de SEO a
 * manter e a divergir. O que se revê aqui é o conteúdo — o título, a descrição,
 * os contadores e as duas pré-visualizações — rota a rota.
 *
 * **`defaults` vem do `seo.ts` importado**, não de uma cópia. É o que faz esta
 * storyboard dizer a verdade: altere-se o `seo.ts` de uma rota e é isto que
 * muda, sem ninguém ter de se lembrar de atualizar o canvas.
 *
 * ## Duas regras que não se relaxam
 *
 * **Nenhuma storyboard escreve na base de dados.** `onSave` devolve `{}` e não
 * chega a lado nenhum. Uma storyboard que gravasse em `seo_pages` a partir do
 * canvas seria um segundo caminho de escrita para a mesma tabela, sem o
 * `is_admin()` do ecrã real — a escrita vive só em `/admin/seo`, com a RLS de
 * 05 §1.9.
 *
 * **`override` é sempre `null` aqui.** Estas storyboards mostram o valor
 * versionado, que é o que o git controla; os três estados de sobreposição
 * (*usa predefinições*, *completo*, *incompleto*) revêem-se no canvas `admin`,
 * na storyboard do gestor, que é onde a lista das rotas todas faz sentido.
 *
 * ## Só em tema claro, e com razão
 *
 * As outras páginas do projeto têm par claro/escuro. Aqui não: o que se revê
 * rota a rota é **texto** — o título, a descrição, como ficam no Google e numa
 * partilha. O cromado do editor em escuro já se revê no canvas `admin`
 * (`AdminSeoEscuro`), e repeti-lo doze vezes dava 24 molduras para mostrar o
 * mesmo formulário com outra cor.
 */

const PROVIDERS_THEME = "light" as const;

/** Ver a nota de topo: um beco sem saída, de propósito. */
const semEscrita = async () => ({});

function EditorDeRota({ row }: { row: SeoPageRow }) {
  return (
    <div
      data-theme={PROVIDERS_THEME}
      style={{ minHeight: "100vh", background: "var(--bg)", padding: "24px" }}
    >
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <ThemeProvider initialChoice={PROVIDERS_THEME}>
          <ToastProvider>
            <SeoManager rows={[row]} loadError={false} locale="pt" onSave={semEscrita} />
          </ToastProvider>
        </ThemeProvider>
      </NextIntlClientProvider>
    </div>
  );
}

/** Monta a linha a partir do `seo.ts` da rota — sem copiar valores. */
function linha(
  route: string,
  pageName: string,
  seo: { titleTag: string; metaDescription: string },
  dynamic = false,
): SeoPageRow {
  return {
    route,
    pageName,
    dynamic,
    defaults: { titleTag: seo.titleTag, metaDescription: seo.metaDescription },
    override: null,
    // Sem sobreposição não há alteração para datar: o valor em vigor é o do
    // ficheiro, e quem o alterou está no git. A coluna "quando e por quem"
    // revê-se no canvas `admin`, onde as rotas estão todas lado a lado.
    lastChange: null,
  };
}

export function SeoHome() {
  return <EditorDeRota row={linha("/", "Início", seoHome)} />;
}

export function SeoImoveis() {
  return <EditorDeRota row={linha("/imoveis", "Propriedades", seoImoveis)} />;
}

export function SeoImovel() {
  return <EditorDeRota row={linha("/imoveis/[slug]", "Propriedade (detalhe)", seoImovel, true)} />;
}

export function SeoPreInscricao() {
  return <EditorDeRota row={linha("/pre-inscricao", "Pré-inscrição", seoPreInscricao)} />;
}

export function SeoCriarConta() {
  return <EditorDeRota row={linha("/criar-conta", "Criar conta", seoCriarConta)} />;
}

export function SeoVerificacao() {
  return (
    <EditorDeRota row={linha("/criar-conta/verificacao", "Verificar e-mail", seoVerificacao)} />
  );
}

export function SeoEntrar() {
  return <EditorDeRota row={linha("/entrar", "Entrar", seoEntrar)} />;
}

export function SeoRecuperar() {
  return (
    <EditorDeRota
      row={linha("/recuperar-palavra-passe", "Recuperar palavra-passe", seoRecuperar)}
    />
  );
}

export function SeoConfirmar() {
  return (
    <EditorDeRota
      row={linha("/recuperar-palavra-passe/confirmar", "Definir nova palavra-passe", seoConfirmar)}
    />
  );
}

export function SeoTermos() {
  return <EditorDeRota row={linha("/termos", "Termos e Condições", seoTermos)} />;
}

export function SeoPrivacidade() {
  return <EditorDeRota row={linha("/privacidade", "Política de Privacidade", seoPrivacidade)} />;
}

export function SeoCookies() {
  return <EditorDeRota row={linha("/cookies", "Política de Cookies", seoCookies)} />;
}
