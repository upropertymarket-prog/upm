import { Canvas, Storyboard } from "tempo-sdk/canvas";
import {
  SuporteTicketsClaro,
  SuporteTicketsEscuro,
  SuporteTicketsFilaVazia,
  SuporteTicketsFilaVaziaEscuro,
  SuporteTicketsSemSelecao,
  SuporteTicketsSemSelecaoEscuro,
} from "./Tickets";

/**
 * Canvas do Suporte — pela ordem do menu
 * =========================================================================
 * A área `/suporte` nasceu na Fase 10 e este é o seu canvas. **A ordem vertical
 * segue `SUPPORT_NAV`** (`apps/interno/src/lib/navigation.ts`): Caixa de
 * e-mail, Tickets, Atualizações, Campanhas, Métricas de e-mail, Cloud interna,
 * Assinaturas. Percorrer o canvas de cima a baixo é percorrer o menu de cima a
 * baixo, como no canvas do Admin e no do Proprietário.
 *
 * **Hoje só Tickets tem storyboards, porque só Tickets existe.** Das sete
 * entradas do menu, seis ainda não têm rota: a Caixa de e-mail e o Composer são
 * P10-04/P10-05, as Assinaturas P10-06 e a Cloud interna P10-10. Uma storyboard
 * de um ecrã que não existe seria UI escrita dentro da pasta do canvas — é o
 * erro que já custou as storyboards do Proprietário na Fase 4 (ver a nota desse
 * canvas). Entram aqui, cada uma na sua posição, à medida que as rotas nascerem.
 *
 * **As Atualizações, as Campanhas e as Métricas não vão ficar neste canvas:**
 * são trabalho de marketing, não de apoio ao cliente, e vão para um canvas
 * próprio quando existirem — a decisão é do cliente, 13 out 2026.
 *
 * Claro à esquerda (`x: 0`), escuro à direita (`x: 1520`), e os estados do mesmo
 * ecrã por baixo do par a que pertencem. Sem `intrinsicSizing`: o enquadramento
 * é um viewport de monitor e o conteúdo rola lá dentro, como num ecrã a sério.
 */
export default function SuporteCanvas() {
  return (
    <Canvas name="Suporte" backgroundColor="#232323">
      {/* Tickets (2.ª entrada do menu; a 1.ª, a Caixa de e-mail, é P10-04) */}
      <Storyboard
        id="SuporteTicketsClaro"
        name="Tickets · Claro (/suporte/tickets)"
        component={SuporteTicketsClaro}
        layout={{ x: 0, y: 0, width: 1440, height: 1000 }}
      />
      <Storyboard
        id="SuporteTicketsEscuro"
        name="Tickets · Escuro (/suporte/tickets)"
        component={SuporteTicketsEscuro}
        layout={{ x: 1520, y: 0, width: 1440, height: 1000 }}
      />

      {/* O ecrã de quem acaba de entrar: fila cheia, nada aberto */}
      <Storyboard
        id="SuporteTicketsSemSelecao"
        name="Tickets · Sem ticket aberto · Claro"
        component={SuporteTicketsSemSelecao}
        layout={{ x: 0, y: 1080, width: 1440, height: 900 }}
      />
      <Storyboard
        id="SuporteTicketsSemSelecaoEscuro"
        name="Tickets · Sem ticket aberto · Escuro"
        component={SuporteTicketsSemSelecaoEscuro}
        layout={{ x: 1520, y: 1080, width: 1440, height: 900 }}
      />

      {/* Nada a tratar — tem de se ler como boa notícia, não como falha */}
      <Storyboard
        id="SuporteTicketsFilaVazia"
        name="Tickets · Fila vazia · Claro"
        component={SuporteTicketsFilaVazia}
        layout={{ x: 0, y: 2060, width: 1440, height: 900 }}
      />
      <Storyboard
        id="SuporteTicketsFilaVaziaEscuro"
        name="Tickets · Fila vazia · Escuro"
        component={SuporteTicketsFilaVaziaEscuro}
        layout={{ x: 1520, y: 2060, width: 1440, height: 900 }}
      />
    </Canvas>
  );
}
