import { Canvas, Storyboard } from "tempo-sdk/canvas";

import { ContratoClaro, ContratoEscuro } from "./Contrato";
import {
  CookiesClaro,
  CookiesEscuro,
  PrivacidadeClaro,
  PrivacidadeEscuro,
  TermosClaro,
  TermosEscuro,
} from "./Ecrans";

/**
 * Páginas legais — Fase 9 (P9-02) e, mais tarde, Fase 11 (P11-07).
 *
 * Separado de `canvases/autenticacao` a 6 out 2026: `/termos` estava no meio
 * dos seis ecrãs de auth por acidente de origem. Não é um ecrã de autenticação
 * — é o documento que a caixa de aceitação abre, e revê-se com olhos de
 * conteúdo legal, não de formulário.
 *
 * Três páginas, cada uma em claro e escuro, aos pares: 80 px entre o par, e
 * largura de 1440 como nos outros canvases.
 *
 * **Viewport de monitor 1440 × 900, como em todos os outros canvases.** O
 * documento é longo e **rola dentro da moldura**, exatamente como rola num
 * browser: o que se revê numa storyboard é o enquadramento — a coluna, as
 * margens, a tipografia, o aviso de minuta —, não o texto todo de uma vez.
 *
 * Duas tentativas anteriores, ambas erradas, ficam registadas para não se
 * repetirem:
 *
 * 1. `intrinsicSizing: "root-element"` — encolhe a moldura à largura do
 *    CONTEÚDO, e estas páginas são `max-w-3xl` centrado. Cada storyboard
 *    colapsou para uma largura diferente (1099 px numas, 531 px noutras) e as
 *    margens da página real desapareceram.
 * 2. Altura medida documento a documento (12 600 / 6 000 / 2 450 px) — corrigia
 *    a largura mas dava molduras gigantescas, impossíveis de comparar lado a
 *    lado, e que obrigavam a reafinar a altura a cada alteração do texto.
 *
 * Privacidade e Cookies entraram a 6 out 2026, com as rotas `/privacidade` e
 * `/cookies` (P11-07 antecipada). Proteção de Dados fica para quando tiver
 * página; o `Ecrans.tsx` explica porquê.
 *
 * O **contrato de adesão** entrou a 7 out 2026 (doc 13), e a rota
 * `/plano/contrato` foi implementada no mesmo dia. É o único destes quatro
 * documentos que vive na app autenticada e não no site público — está aqui
 * porque é um documento legal, e é com os outros três que se revê.
 */
export default function LegalCanvas() {
  return (
    <Canvas name="Legal" backgroundColor="#232323">
      <Storyboard
        id="TermosClaro"
        name="Termos e Condições · Claro (/termos)"
        component={TermosClaro}
        layout={{ x: 0, y: 0, width: 1440, height: 900 }}
      />
      <Storyboard
        id="TermosEscuro"
        name="Termos e Condições · Escuro (/termos)"
        component={TermosEscuro}
        layout={{ x: 1520, y: 0, width: 1440, height: 900 }}
      />

      <Storyboard
        id="PrivacidadeClaro"
        name="Política de Privacidade · Claro (/privacidade)"
        component={PrivacidadeClaro}
        layout={{ x: 0, y: 980, width: 1440, height: 900 }}
      />
      <Storyboard
        id="PrivacidadeEscuro"
        name="Política de Privacidade · Escuro (/privacidade)"
        component={PrivacidadeEscuro}
        layout={{ x: 1520, y: 980, width: 1440, height: 900 }}
      />

      <Storyboard
        id="CookiesClaro"
        name="Política de Cookies · Claro (/cookies)"
        component={CookiesClaro}
        layout={{ x: 0, y: 1960, width: 1440, height: 900 }}
      />
      <Storyboard
        id="CookiesEscuro"
        name="Política de Cookies · Escuro (/cookies)"
        component={CookiesEscuro}
        layout={{ x: 1520, y: 1960, width: 1440, height: 900 }}
      />

      <Storyboard
        id="ContratoClaro"
        name="Contrato de adesão · Claro (/plano/contrato)"
        component={ContratoClaro}
        layout={{ x: 0, y: 2940, width: 1440, height: 900 }}
      />
      <Storyboard
        id="ContratoEscuro"
        name="Contrato de adesão · Escuro (/plano/contrato)"
        component={ContratoEscuro}
        layout={{ x: 1520, y: 2940, width: 1440, height: 900 }}
      />
    </Canvas>
  );
}
