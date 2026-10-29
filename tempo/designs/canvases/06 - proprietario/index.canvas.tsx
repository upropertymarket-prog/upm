import { Canvas, Storyboard } from "tempo-sdk/canvas";
import Painel, { PainelEscuro } from "./Painel";
import Mensagens, { Agenda, AgendaEscuro, Leads, LeadsEscuro, MensagensEscuro } from "./Interacao";
import {
  DetalheClaro,
  DetalheEscuro,
  MeuAnuncioClaro,
  MeuAnuncioEscuro,
  MarketClaro,
  MarketEscuro,
  NovaPropriedadeClaro,
  NovaPropriedadeEscuro,
  PropriedadesClaro,
  PropriedadesEscuro,
} from "./Imoveis";
import { DefinicoesClaro, DefinicoesEscuro, MapaClaro, MapaEscuro } from "./MapaDefinicoes";
import { CloudClaro, CloudEscuro, ContratosClaro, ContratosEscuro } from "./CloudContracts";
import { PlanoClaro, PlanoEscuro } from "./Billing";
import {
  MeusReportsClaro,
  MeusReportsEscuro,
  ReportarProblemaClaro,
  ReportarProblemaEscuro,
} from "./Reports";

/**
 * Canvas do Proprietário — o perfil completo, ecrã a ecrã.
 *
 * As storyboards de Market, Detalhe, As minhas propriedades, Nova propriedade e
 * Mapa tinham sido removidas na Fase 4: eram UI escrita dentro da pasta do
 * canvas, com pixels e cores próprios, e não uma projeção dos componentes da
 * app (registo no doc "Registo — storyboards do Proprietário removidas (Fase
 * 4)", código em `174b63f`). Voltam agora reconstruídas como deviam — um
 * invólucro fino à volta dos componentes que as rotas usam — junto com
 * Definições, que nunca chegou a ter storyboard.
 *
 * O Detalhe foi o último a poder voltar: só depois de `/market/[id]` deixar de
 * ter a ficha escrita dentro da própria página, hoje no `PropertyDetail`.
 *
 * Sem `intrinsicSizing`: o enquadramento é um viewport de monitor (1440 × 900)
 * e o conteúdo rola lá dentro, como num ecrã verdadeiro.
 *
 * **Arrumação: duas colunas.** À esquerda (`x: 0`) o modo claro, à direita
 * (`x: 1520`) o escuro — 80 px entre eles, 80 px entre linhas. 04 §5.2 trata o
 * modo escuro como requisito, não como variante opcional: ver o par lado a lado
 * é o que apanha um contraste mau antes do código.
 *
 * **As linhas seguem a ordem da sidebar** de 07 §4.3, para percorrer o canvas
 * de cima a baixo ser percorrer o menu de cima a baixo: Painel, Market,
 * As minhas propriedades, Leads, Mensagens, Agenda, Mapa, Cloud, Contratos,
 * Plano, Definições. Os dois ecrãs que não são itens de menu ficam logo a
 * seguir ao item de onde se chega a eles — Detalhe depois do Market, Nova
 * propriedade depois de As minhas propriedades.
 *
 * "Os meus reports" entrou a 13 out 2026, no lugar que `myReports` tem na
 * sidebar — entre Contratos e Plano. A rota `/reports` nasceu com P10-02 e era
 * a única entrada do menu sem storyboard.
 *
 * O modal **Reportar problema** não é uma página — é o botão do rodapé da
 * sidebar, igual nos quatro perfis — mas é desenhado por cima de `/reports`,
 * por isso fica logo a seguir a "Os meus reports" (pedido a 28 out 2026).
 */
export default function ProprietarioCanvas() {
  return (
    <Canvas name="06 - proprietario" backgroundColor="#232323">
      <Storyboard
        id="Painel"
        name="Painel · Claro (/painel)"
        component={Painel}
        layout={{ x: 1, y: 0, width: 1440, height: 900 }}
      />
      <Storyboard
        id="PainelEscuro"
        name="Painel · Escuro (/painel)"
        component={PainelEscuro}
        layout={{ x: 1520, y: 0, width: 1440, height: 900 }}
      />
      <Storyboard
        id="MarketClaro"
        name="Market · Claro (/market)"
        component={MarketClaro}
        layout={{ x: 0, y: 980, width: 1440, height: 900 }}
      />
      <Storyboard
        id="MarketEscuro"
        name="Market · Escuro (/market)"
        component={MarketEscuro}
        layout={{ x: 1520, y: 980, width: 1440, height: 900 }}
      />

      <Storyboard
        id="DetalheClaro"
        name="Detalhe do imóvel · Claro (/market/[id])"
        component={DetalheClaro}
        layout={{ x: 0, y: 1960, width: 1440, height: 900 }}
      />
      <Storyboard
        id="DetalheEscuro"
        name="Detalhe do imóvel · Escuro (/market/[id])"
        component={DetalheEscuro}
        layout={{ x: 1520, y: 1960, width: 1440, height: 900 }}
      />
      {/* A mesma rota vista pelo dono do anúncio: linha própria, para o canvas
          se manter em duas colunas (07 §22). */}
      <Storyboard
        id="MeuAnuncioClaro"
        name="O meu anúncio · Claro (/market/[id])"
        component={MeuAnuncioClaro}
        layout={{ x: 0, y: 2940, width: 1440, height: 900 }}
      />
      <Storyboard
        id="MeuAnuncioEscuro"
        name="O meu anúncio · Escuro (/market/[id])"
        component={MeuAnuncioEscuro}
        layout={{ x: 1520, y: 2940, width: 1440, height: 900 }}
      />

      <Storyboard
        id="PropriedadesClaro"
        name="As minhas propriedades · Claro (/propriedades)"
        component={PropriedadesClaro}
        layout={{ x: 0, y: 3920, width: 1440, height: 900 }}
      />
      <Storyboard
        id="PropriedadesEscuro"
        name="As minhas propriedades · Escuro (/propriedades)"
        component={PropriedadesEscuro}
        layout={{ x: 1520, y: 3920, width: 1440, height: 900 }}
      />

      <Storyboard
        id="NovaPropriedadeClaro"
        name="Nova propriedade · Claro (/propriedades/nova)"
        component={NovaPropriedadeClaro}
        layout={{ x: 0, y: 4900, width: 1440, height: 900 }}
      />
      <Storyboard
        id="NovaPropriedadeEscuro"
        name="Nova propriedade · Escuro (/propriedades/nova)"
        component={NovaPropriedadeEscuro}
        layout={{ x: 1520, y: 4900, width: 1440, height: 900 }}
      />

      <Storyboard
        id="Leads"
        name="Leads · Claro (/leads)"
        component={Leads}
        layout={{ x: 0, y: 5880, width: 1440, height: 900 }}
      />
      <Storyboard
        id="LeadsEscuro"
        name="Leads · Escuro (/leads)"
        component={LeadsEscuro}
        layout={{ x: 1520, y: 5880, width: 1440, height: 900 }}
      />

      <Storyboard
        id="Mensagens"
        name="Mensagens · Claro (/mensagens)"
        component={Mensagens}
        layout={{ x: 0, y: 6860, width: 1440, height: 900 }}
      />
      <Storyboard
        id="MensagensEscuro"
        name="Mensagens · Escuro (/mensagens)"
        component={MensagensEscuro}
        layout={{ x: 1520, y: 6860, width: 1440, height: 900 }}
      />

      <Storyboard
        id="Agenda"
        name="Agenda de visitas · Claro (/agenda)"
        component={Agenda}
        layout={{ x: 0, y: 7840, width: 1440, height: 900 }}
      />
      <Storyboard
        id="AgendaEscuro"
        name="Agenda de visitas · Escuro (/agenda)"
        component={AgendaEscuro}
        layout={{ x: 1520, y: 7840, width: 1440, height: 900 }}
      />

      <Storyboard
        id="MapaClaro"
        name="Mapa · Claro (/mapa)"
        component={MapaClaro}
        layout={{ x: 0, y: 8820, width: 1440, height: 900 }}
      />
      <Storyboard
        id="MapaEscuro"
        name="Mapa · Escuro (/mapa)"
        component={MapaEscuro}
        layout={{ x: 1520, y: 8820, width: 1440, height: 900 }}
      />

      <Storyboard
        id="CloudClaro"
        name="Cloud · Claro (/cloud)"
        component={CloudClaro}
        layout={{ x: 0, y: 9800, width: 1440, height: 900 }}
      />
      <Storyboard
        id="CloudEscuro"
        name="Cloud · Escuro (/cloud)"
        component={CloudEscuro}
        layout={{ x: 1520, y: 9800, width: 1440, height: 900 }}
      />

      <Storyboard
        id="ContratosClaro"
        name="Contratos · Claro (/contratos)"
        component={ContratosClaro}
        layout={{ x: 0, y: 10780, width: 1440, height: 900 }}
      />
      <Storyboard
        id="ContratosEscuro"
        name="Contratos · Escuro (/contratos)"
        component={ContratosEscuro}
        layout={{ x: 1520, y: 10780, width: 1440, height: 900 }}
      />

      <Storyboard
        id="MeusReportsClaro"
        name="Os meus reports · Claro (/reports)"
        component={MeusReportsClaro}
        layout={{ x: 0, y: 11760, width: 1440, height: 900 }}
      />
      <Storyboard
        id="MeusReportsEscuro"
        name="Os meus reports · Escuro (/reports)"
        component={MeusReportsEscuro}
        layout={{ x: 1520, y: 11760, width: 1440, height: 900 }}
      />
      {/* Transversal aos quatro perfis (o botão do rodapé da sidebar), mas
          desenhado por cima de /reports — fica colado a "Os meus reports". */}
      <Storyboard
        id="ReportarProblemaClaro"
        name="Reportar problema · Claro"
        component={ReportarProblemaClaro}
        layout={{ x: 0, y: 12740, width: 1440, height: 900 }}
      />
      <Storyboard
        id="ReportarProblemaEscuro"
        name="Reportar problema · Escuro"
        component={ReportarProblemaEscuro}
        layout={{ x: 1520, y: 12740, width: 1440, height: 900 }}
      />

      <Storyboard
        id="Plano"
        name="Plano e faturação · Claro (/plano)"
        component={PlanoClaro}
        layout={{ x: 0, y: 13720, width: 1440, height: 900 }}
      />
      <Storyboard
        id="PlanoEscuro"
        name="Plano e faturação · Escuro (/plano)"
        component={PlanoEscuro}
        layout={{ x: 1520, y: 13720, width: 1440, height: 900 }}
      />

      <Storyboard
        id="DefinicoesClaro"
        name="Definições · Claro (/definicoes)"
        component={DefinicoesClaro}
        layout={{ x: 0, y: 14700, width: 1440, height: 900 }}
      />
      <Storyboard
        id="DefinicoesEscuro"
        name="Definições · Escuro (/definicoes)"
        component={DefinicoesEscuro}
        layout={{ x: 1520, y: 14700, width: 1440, height: 900 }}
      />
    </Canvas>
  );
}
