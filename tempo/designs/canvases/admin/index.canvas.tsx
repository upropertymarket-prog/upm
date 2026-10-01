import { Canvas, Storyboard } from "tempo-sdk/canvas";
import { AdminContratosClaro, AdminContratosEscuro } from "./Demo";

export default function AdminCanvas() {
  return (
    <Canvas name="Admin" backgroundColor="#232323">
      <Storyboard
        id="AdminContratosClaro"
        name="Templates de contrato · Claro"
        component={AdminContratosClaro}
        layout={{ x: 0, y: 0, width: 1440, height: 900, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="AdminContratosEscuro"
        name="Templates de contrato · Escuro"
        component={AdminContratosEscuro}
        layout={{ x: 1490, y: 0, width: 1440, height: 900, intrinsicSizing: "root-element" }}
      />
    </Canvas>
  );
}
