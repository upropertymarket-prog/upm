import { Canvas, Storyboard } from "tempo-sdk/canvas";
import {
  SuporteCaixaClaro,
  SuporteCaixaEscuro,
  SuporteCaixaSemCaixas,
  SuporteCaixaSemCaixasEscuro,
  SuporteCaixaSemSelecao,
  SuporteCaixaSemSelecaoEscuro,
  SuporteComposerClaro,
  SuporteComposerEscuro,
} from "./Mailbox";
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
 * **Entram à medida que as rotas nascem.** A Caixa de e-mail (P10-04) e os
 * Tickets (P10-02) já existem; o Composer é P10-05, as Assinaturas P10-06 e a
 * Cloud interna P10-10. Uma storyboard de um ecrã que não existe seria UI
 * escrita dentro da pasta do canvas — é o erro que já custou as storyboards do
 * Proprietário na Fase 4 (ver a nota desse canvas).
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
      {/* Caixa de e-mail — 1.ª entrada do menu (P10-04) */}
      <Storyboard
        id="SuporteCaixaClaro"
        name="Caixa de e-mail · Claro (/suporte/email)"
        component={SuporteCaixaClaro}
        layout={{ x: 0, y: 0, width: 1440, height: 1000 }}
      />
      <Storyboard
        id="SuporteCaixaEscuro"
        name="Caixa de e-mail · Escuro (/suporte/email)"
        component={SuporteCaixaEscuro}
        layout={{ x: 1520, y: 0, width: 1440, height: 1000 }}
      />

      {/* O ecrã de quem entra: fila à vista, nada aberto */}
      <Storyboard
        id="SuporteCaixaSemSelecao"
        name="Caixa de e-mail · Sem mensagem aberta · Claro"
        component={SuporteCaixaSemSelecao}
        layout={{ x: 0, y: 1080, width: 1440, height: 900 }}
      />
      <Storyboard
        id="SuporteCaixaSemSelecaoEscuro"
        name="Caixa de e-mail · Sem mensagem aberta · Escuro"
        component={SuporteCaixaSemSelecaoEscuro}
        layout={{ x: 1520, y: 1080, width: 1440, height: 900 }}
      />

      {/* Composer (P10-05): a janela de escrever por cima da caixa */}
      <Storyboard
        id="SuporteComposerClaro"
        name="Composer · Claro (/suporte/email)"
        component={SuporteComposerClaro}
        layout={{ x: 0, y: 2060, width: 1440, height: 1000 }}
      />
      <Storyboard
        id="SuporteComposerEscuro"
        name="Composer · Escuro (/suporte/email)"
        component={SuporteComposerEscuro}
        layout={{ x: 1520, y: 2060, width: 1440, height: 1000 }}
      />

      {/* O estado real de hoje: ainda não há caixas criadas na Amen */}
      <Storyboard
        id="SuporteCaixaSemCaixas"
        name="Caixa de e-mail · Sem caixas configuradas · Claro"
        component={SuporteCaixaSemCaixas}
        layout={{ x: 0, y: 3140, width: 1440, height: 700 }}
      />
      <Storyboard
        id="SuporteCaixaSemCaixasEscuro"
        name="Caixa de e-mail · Sem caixas configuradas · Escuro"
        component={SuporteCaixaSemCaixasEscuro}
        layout={{ x: 1520, y: 3140, width: 1440, height: 700 }}
      />

      {/* Tickets — 2.ª entrada do menu (P10-02) */}
      <Storyboard
        id="SuporteTicketsClaro"
        name="Tickets · Claro (/suporte/tickets)"
        component={SuporteTicketsClaro}
        layout={{ x: 0, y: 3920, width: 1440, height: 1000 }}
      />
      <Storyboard
        id="SuporteTicketsEscuro"
        name="Tickets · Escuro (/suporte/tickets)"
        component={SuporteTicketsEscuro}
        layout={{ x: 1520, y: 3920, width: 1440, height: 1000 }}
      />

      {/* O ecrã de quem acaba de entrar: fila cheia, nada aberto */}
      <Storyboard
        id="SuporteTicketsSemSelecao"
        name="Tickets · Sem ticket aberto · Claro"
        component={SuporteTicketsSemSelecao}
        layout={{ x: 0, y: 5000, width: 1440, height: 900 }}
      />
      <Storyboard
        id="SuporteTicketsSemSelecaoEscuro"
        name="Tickets · Sem ticket aberto · Escuro"
        component={SuporteTicketsSemSelecaoEscuro}
        layout={{ x: 1520, y: 5000, width: 1440, height: 900 }}
      />

      {/* Nada a tratar — tem de se ler como boa notícia, não como falha */}
      <Storyboard
        id="SuporteTicketsFilaVazia"
        name="Tickets · Fila vazia · Claro"
        component={SuporteTicketsFilaVazia}
        layout={{ x: 0, y: 5980, width: 1440, height: 900 }}
      />
      <Storyboard
        id="SuporteTicketsFilaVaziaEscuro"
        name="Tickets · Fila vazia · Escuro"
        component={SuporteTicketsFilaVaziaEscuro}
        layout={{ x: 1520, y: 5980, width: 1440, height: 900 }}
      />
    </Canvas>
  );
}
