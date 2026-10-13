import { Canvas, Storyboard } from "tempo-sdk/canvas";

import {
  SeoConfirmar,
  SeoCookies,
  SeoCriarConta,
  SeoEntrar,
  SeoHome,
  SeoImoveis,
  SeoImovel,
  SeoPreInscricao,
  SeoPrivacidade,
  SeoRecuperar,
  SeoTermos,
  SeoVerificacao,
} from "./Ecrans";

/**
 * SEO por rota pública (P2-06 · 04 §2.1 · 07, decisão de 7 out 2026)
 * =========================================================================
 * Uma storyboard por rota pública, cada uma a importar o `seo.ts` da sua rota.
 * É a tradução da "storyboard SEO Manager" de 04 §2.1.1 para a convenção que
 * este repositório usa — o `Ecrans.tsx` tem o relato completo de porquê não são
 * Route Storyboards (resumo: o projeto tem zero, e a D9 bloqueia-as).
 *
 * **A ordem é a do visitante, não a do repositório**: primeiro o que se vê sem
 * conta — home, catálogo, detalhe, pré-inscrição —, depois o funil de conta e
 * por fim as páginas legais. Quem vem rever títulos e descrições percorre o
 * site.
 *
 * Molduras de 1440 × 900 e passo de 980, como em todos os canvases do projeto.
 * Uma coluna só: não há par claro/escuro aqui, e a razão está no `Ecrans.tsx`.
 */
export default function SeoCanvas() {
  return (
    <Canvas name="SEO" backgroundColor="#232323">
      {/* Público, sem conta */}
      <Storyboard
        id="SeoHome"
        name="SEO · Início (/)"
        component={SeoHome}
        layout={{ x: 0, y: 0, width: 1440, height: 900 }}
      />
      <Storyboard
        id="SeoImoveis"
        name="SEO · Propriedades (/imoveis)"
        component={SeoImoveis}
        layout={{ x: 0, y: 980, width: 1440, height: 900 }}
      />
      <Storyboard
        id="SeoImovel"
        name="SEO · Propriedade, detalhe (/imoveis/[slug])"
        component={SeoImovel}
        layout={{ x: 0, y: 1960, width: 1440, height: 900 }}
      />
      <Storyboard
        id="SeoPreInscricao"
        name="SEO · Pré-inscrição (/pre-inscricao)"
        component={SeoPreInscricao}
        layout={{ x: 0, y: 2940, width: 1440, height: 900 }}
      />

      {/* Funil de conta */}
      <Storyboard
        id="SeoCriarConta"
        name="SEO · Criar conta (/criar-conta)"
        component={SeoCriarConta}
        layout={{ x: 0, y: 3920, width: 1440, height: 900 }}
      />
      <Storyboard
        id="SeoVerificacao"
        name="SEO · Verificar e-mail (/criar-conta/verificacao)"
        component={SeoVerificacao}
        layout={{ x: 0, y: 4900, width: 1440, height: 900 }}
      />
      <Storyboard
        id="SeoEntrar"
        name="SEO · Entrar (/entrar)"
        component={SeoEntrar}
        layout={{ x: 0, y: 5880, width: 1440, height: 900 }}
      />
      <Storyboard
        id="SeoRecuperar"
        name="SEO · Recuperar palavra-passe (/recuperar-palavra-passe)"
        component={SeoRecuperar}
        layout={{ x: 0, y: 6860, width: 1440, height: 900 }}
      />
      <Storyboard
        id="SeoConfirmar"
        name="SEO · Nova palavra-passe (/recuperar-palavra-passe/confirmar)"
        component={SeoConfirmar}
        layout={{ x: 0, y: 7840, width: 1440, height: 900 }}
      />

      {/* Legais */}
      <Storyboard
        id="SeoTermos"
        name="SEO · Termos e Condições (/termos)"
        component={SeoTermos}
        layout={{ x: 0, y: 8820, width: 1440, height: 900 }}
      />
      <Storyboard
        id="SeoPrivacidade"
        name="SEO · Política de Privacidade (/privacidade)"
        component={SeoPrivacidade}
        layout={{ x: 0, y: 9800, width: 1440, height: 900 }}
      />
      <Storyboard
        id="SeoCookies"
        name="SEO · Política de Cookies (/cookies)"
        component={SeoCookies}
        layout={{ x: 0, y: 10780, width: 1440, height: 900 }}
      />
    </Canvas>
  );
}
