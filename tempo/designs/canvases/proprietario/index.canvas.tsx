import { Canvas, Storyboard } from "tempo-sdk/canvas";
import Novapropriedade from "./NovaPropriedade";
import Asminhaspropriedades from "./AsMinhasPropriedades";
import Market2 from "./Market";
import Mapa2 from "./Mapa";
import DetalhePropriedade from "./DetalhePropriedade";
import Painel from "./Painel";

export default function ProprietarioCanvas() {
  return (
    <Canvas name="Proprietario" backgroundColor="#232323">
      <Storyboard
        id="Painel"
        name="Painel (/painel)"
        component={Painel}
        layout={{ x: 0, y: 1986, width: 1400, height: 1329, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="NovaPropriedade"
        name="Nova propriedade (/propriedades/nova)"
        component={Novapropriedade}
        layout={{ x: -74, y: -432, width: 1400, height: 900, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="AsMinhasPropriedades"
        name="As minhas propriedades (/propriedades)"
        component={Asminhaspropriedades}
        layout={{ x: 1450, y: -432, width: 1400, height: 900, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="Market"
        name="Market (/market)"
        component={Market2}
        layout={{ x: -74, y: 1036, width: 1400, height: 900, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="DetalhePropriedade"
        name="Detalhe da propriedade (/market/[id])"
        component={DetalhePropriedade}
        layout={{ x: 2974, y: -432, width: 1400, height: 1238, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="Mapa"
        name="Mapa (/mapa)"
        component={Mapa2}
        layout={{ x: 1450, y: 1036, width: 1400, height: 900, intrinsicSizing: "root-element" }}
      />
    </Canvas>
  );
}
