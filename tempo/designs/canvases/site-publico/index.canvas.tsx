import { Canvas, Storyboard } from "tempo-sdk/canvas";
import { PreLancamentoClaro as PreLancamentoClaro2 } from "./Ecrans";
import { PreLancamentoEscuro as PreLancamentoEscuro2 } from "./Ecrans";
import { PosLancamentoClaro as PosLancamentoClaro2 } from "./Ecrans";
import { PosLancamentoEscuro as PosLancamentoEscuro2 } from "./Ecrans";
import { PreInscricaoClaro as PreInscricaoClaro2 } from "./Ecrans";

export default function SitePublicoCanvas() {
  return (
    <Canvas name="site-publico" backgroundColor="#232323">
      <Storyboard
        id="PreLancamentoClaro"
        name="Pré-lançamento · claro"
        component={PreLancamentoClaro2}
        layout={{ x: 0, y: 0, width: 1440, height: 900, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="PreLancamentoEscuro"
        name="Pré-lançamento · escuro"
        component={PreLancamentoEscuro2}
        layout={{ x: 1490, y: 0, width: 1440, height: 900, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="PosLancamentoClaro"
        name="Pós-lançamento · claro"
        component={PosLancamentoClaro2}
        layout={{ x: 0, y: 950, width: 1440, height: 900, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="PosLancamentoEscuro"
        name="Pós-lançamento · escuro"
        component={PosLancamentoEscuro2}
        layout={{ x: 1490, y: 950, width: 1440, height: 900, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="PreInscricaoClaro"
        name="Pré-inscrição · claro"
        component={PreInscricaoClaro2}
        layout={{ x: 0, y: 2850, width: 1440, height: 900, intrinsicSizing: "root-element" }}
      />
    </Canvas>
  );
}
