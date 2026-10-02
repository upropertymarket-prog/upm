import { Canvas, Storyboard } from "tempo-sdk/canvas";
import Painel, { PainelEscuro } from "./Painel";
import Mensagens, { Agenda, AgendaEscuro, Leads, LeadsEscuro, MensagensEscuro } from "./Interacao";
import { CloudClaro, CloudEscuro, ContratosClaro, ContratosEscuro } from "./CloudContracts";
import { PlanoClaro, PlanoEscuro } from "./Billing";

/**
 * Canvas do Proprietário — Painel (Fase 4, completo na Fase 5) e os três ecrãs
 * da Fase 5: Mensagens, Agenda de visitas e Leads.
 *
 * As storyboards de Market, Mapa, As minhas propriedades, Nova propriedade e
 * Detalhe foram removidas na Fase 4 em favor de as reconstruir a partir de
 * componentes reais da app; o registo do que existia está no doc "Registo —
 * storyboards do Proprietário removidas (Fase 4)" e o código em `174b63f`.
 *
 * Sem `intrinsicSizing`: o enquadramento é um viewport de monitor (1440 × 900)
 * e o conteúdo rola lá dentro, como num ecrã verdadeiro.
 *
 * **Arrumação: duas colunas.** À esquerda (`x: 0`) o modo claro, à direita
 * (`x: 1520`) o escuro — 80 px entre eles, 80 px entre linhas. As linhas seguem
 * a **ordem da sidebar** de 07 §4.3, não a ordem em que os ecrãs foram
 * construídos: Painel (1.º), Leads (4.º), Mensagens (5.º), Agenda de visitas
 * (6.º). Os lugares vazios entre eles são as páginas que ainda não existem —
 * Market, As minhas propriedades, Mapa, Cloud, Contratos, reports, Plano e
 * Definições entram nas suas linhas quando forem construídas.
 *
 * 04 §5.2 trata o modo escuro como requisito, não como variante opcional —
 * ver o par lado a lado é o que apanha um contraste mau antes do código.
 */
export default function ProprietarioCanvas() {
  return (
    <Canvas name="Proprietario" backgroundColor="#232323">
      <Storyboard
        id="Painel"
        name="Painel · Claro (/painel)"
        component={Painel}
        layout={{ x: 0, y: 0, width: 1440, height: 900 }}
      />
      <Storyboard
        id="PainelEscuro"
        name="Painel · Escuro (/painel)"
        component={PainelEscuro}
        layout={{ x: 1520, y: 0, width: 1440, height: 900 }}
      />
      <Storyboard
        id="Leads"
        name="Leads · Claro (/leads)"
        component={Leads}
        layout={{ x: 0, y: 980, width: 1440, height: 900 }}
      />
      <Storyboard
        id="LeadsEscuro"
        name="Leads · Escuro (/leads)"
        component={LeadsEscuro}
        layout={{ x: 1520, y: 980, width: 1440, height: 900 }}
      />

      <Storyboard
        id="Mensagens"
        name="Mensagens · Claro (/mensagens)"
        component={Mensagens}
        layout={{ x: 0, y: 1960, width: 1440, height: 900 }}
      />
      <Storyboard
        id="MensagensEscuro"
        name="Mensagens · Escuro (/mensagens)"
        component={MensagensEscuro}
        layout={{ x: 1520, y: 1960, width: 1440, height: 900 }}
      />

      <Storyboard
        id="Agenda"
        name="Agenda de visitas · Claro (/agenda)"
        component={Agenda}
        layout={{ x: 0, y: 2940, width: 1440, height: 900 }}
      />
      <Storyboard
        id="AgendaEscuro"
        name="Agenda de visitas · Escuro (/agenda)"
        component={AgendaEscuro}
        layout={{ x: 1520, y: 2940, width: 1440, height: 900 }}
      />
      <Storyboard
        id="CloudClaro"
        name="Cloud · Claro (/cloud)"
        component={CloudClaro}
        layout={{ x: 0, y: 3920, width: 1440, height: 900 }}
      />
      <Storyboard
        id="CloudEscuro"
        name="Cloud · Escuro (/cloud)"
        component={CloudEscuro}
        layout={{ x: 1520, y: 3920, width: 1440, height: 900 }}
      />
      <Storyboard
        id="ContratosClaro"
        name="Contratos · Claro (/contratos)"
        component={ContratosClaro}
        layout={{ x: 0, y: 4900, width: 1440, height: 900 }}
      />
      <Storyboard
        id="ContratosEscuro"
        name="Contratos · Escuro (/contratos)"
        component={ContratosEscuro}
        layout={{ x: 1520, y: 4900, width: 1440, height: 900 }}
      />
      <Storyboard
        id="Plano"
        name="Plano e faturação · Claro (/plano)"
        component={PlanoClaro}
        layout={{ x: 0, y: 5880, width: 1440, height: 900 }}
      />
      <Storyboard
        id="PlanoEscuro"
        name="Plano e faturação · Escuro (/plano)"
        component={PlanoEscuro}
        layout={{ x: 1520, y: 5880, width: 1440, height: 900 }}
      />
    </Canvas>
  );
}
