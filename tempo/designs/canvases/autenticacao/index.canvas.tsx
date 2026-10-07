import { Canvas, Storyboard } from "tempo-sdk/canvas";

import {
  CriarContaClaro,
  CriarContaEscuro,
  EntrarClaro,
  EntrarEscuro,
  NovaPalavraPasseClaro,
  NovaPalavraPasseEscuro,
  PedirRecuperacaoClaro,
  PedirRecuperacaoEscuro,
  VerificacaoClaro,
  VerificacaoEscuro,
} from "./Ecrans";

/**
 * Ecrãs de autenticação — Fase 3 (03 F2, F3) e Fase 9.
 *
 * As cinco rotas de auth de `apps/web`, cada uma em claro e escuro, aos pares:
 * o par lado a lado com 80 px entre si, e 80 px entre linhas. Viewport de
 * monitor 1440 × 900, sem `intrinsicSizing` — as páginas têm `min-h-screen`,
 * e é a essa altura que elas se desenham.
 *
 * O conteúdo vive em `Ecrans.tsx`, que monta os componentes reais da app.
 */
export default function AutenticacaoCanvas() {
  return (
    <Canvas name="Autenticacao" backgroundColor="#232323">
      <Storyboard
        id="EntrarClaro"
        name="Entrar · Claro (/entrar)"
        component={EntrarClaro}
        layout={{ x: 0, y: 0, width: 1440, height: 900 }}
      />
      <Storyboard
        id="EntrarEscuro"
        name="Entrar · Escuro (/entrar)"
        component={EntrarEscuro}
        layout={{ x: 1520, y: 0, width: 1440, height: 900 }}
      />

      <Storyboard
        id="CriarContaClaro"
        name="Criar conta · Claro (/criar-conta)"
        component={CriarContaClaro}
        layout={{ x: 0, y: 980, width: 1440, height: 900 }}
      />
      <Storyboard
        id="CriarContaEscuro"
        name="Criar conta · Escuro (/criar-conta)"
        component={CriarContaEscuro}
        layout={{ x: 1520, y: 980, width: 1440, height: 900 }}
      />

      <Storyboard
        id="VerificacaoClaro"
        name="Verificação · Claro (/criar-conta/verificacao)"
        component={VerificacaoClaro}
        layout={{ x: 0, y: 1960, width: 1440, height: 900 }}
      />
      <Storyboard
        id="VerificacaoEscuro"
        name="Verificação · Escuro (/criar-conta/verificacao)"
        component={VerificacaoEscuro}
        layout={{ x: 1520, y: 1960, width: 1440, height: 900 }}
      />

      <Storyboard
        id="PedirRecuperacaoClaro"
        name="Pedir recuperação · Claro (/recuperar-palavra-passe)"
        component={PedirRecuperacaoClaro}
        layout={{ x: 0, y: 2940, width: 1440, height: 900 }}
      />
      <Storyboard
        id="PedirRecuperacaoEscuro"
        name="Pedir recuperação · Escuro (/recuperar-palavra-passe)"
        component={PedirRecuperacaoEscuro}
        layout={{ x: 1520, y: 2940, width: 1440, height: 900 }}
      />

      <Storyboard
        id="NovaPalavraPasseClaro"
        name="Nova palavra-passe · Claro (/recuperar-palavra-passe/confirmar)"
        component={NovaPalavraPasseClaro}
        layout={{ x: 0, y: 3920, width: 1440, height: 900 }}
      />
      <Storyboard
        id="NovaPalavraPasseEscuro"
        name="Nova palavra-passe · Escuro (/recuperar-palavra-passe/confirmar)"
        component={NovaPalavraPasseEscuro}
        layout={{ x: 1520, y: 3920, width: 1440, height: 900 }}
      />
    </Canvas>
  );
}
