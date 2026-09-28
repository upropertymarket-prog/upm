import { Canvas, Storyboard } from "tempo-sdk/canvas";

import { LoginForm } from "../../../../apps/web/src/app/entrar/LoginForm";
import { RegisterWizard } from "../../../../apps/web/src/app/criar-conta/RegisterWizard";
import { RequestForm } from "../../../../apps/web/src/app/recuperar-palavra-passe/RequestForm";
import { NewPasswordForm } from "../../../../apps/web/src/app/recuperar-palavra-passe/confirmar/NewPasswordForm";

/**
 * Ecrãs de autenticação — Fase 3 (03 F2, F3).
 *
 * As Server Actions reais (`signIn`, `registerAccount`, …) importam
 * `next/headers`, exclusivo do servidor — importá-las aqui partiria a
 * compilação do canvas para o projeto inteiro. Os componentes recebem a
 * action por prop (ver `LoginFormProps`/`RegisterWizardProps`/…); a app real
 * injeta a Server Action verdadeira na respetiva `page.tsx`, este canvas
 * injeta estas versões de demonstração, sem qualquer efeito.
 */
async function demoAction<State>(state: State) {
  return state;
}

export default function AutenticacaoCanvas() {
  return (
    <Canvas name="Autenticacao" backgroundColor="#232323">
      <Storyboard
        id="LoginForm"
        name="Login (web /entrar)"
        component={() => <LoginForm action={demoAction} />}
        layout={{ x: 0, y: 0, width: 600, height: 400, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="RegisterWizard"
        name="Registo (web /criar-conta)"
        component={() => <RegisterWizard action={demoAction} />}
        layout={{ x: 650, y: 0, width: 600, height: 400, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="RequestForm"
        name="Pedir recuperação (web /recuperar-palavra-passe)"
        component={() => <RequestForm action={demoAction} />}
        layout={{ x: 1300, y: 0, width: 600, height: 400, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="NewPasswordForm"
        name="Definir nova password (web /recuperar-palavra-passe/confirmar)"
        component={() => <NewPasswordForm action={demoAction} />}
        layout={{ x: 1950, y: 0, width: 600, height: 400, intrinsicSizing: "root-element" }}
      />
    </Canvas>
  );
}
