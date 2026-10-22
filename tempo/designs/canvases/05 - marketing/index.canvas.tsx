import { Canvas, Storyboard } from "tempo-sdk/canvas";
import {
  MarketingAtualizacoesClaro,
  MarketingAtualizacoesEscuro,
  MarketingAtualizacoesVazio,
  MarketingAtualizacoesVazioEscuro,
} from "./Atualizacoes";
import {
  MarketingCampanhasAgendamentoFalhado,
  MarketingCampanhasAgendamentoFalhadoEscuro,
  MarketingCampanhasClaro,
  MarketingCampanhasConstrutor,
  MarketingCampanhasConstrutorEscuro,
  MarketingCampanhasEscuro,
  MarketingCampanhasSemSelecao,
  MarketingCampanhasSemSelecaoEscuro,
} from "./Campanhas";
import {
  MarketingModelosClaro,
  MarketingModelosEscuro,
  MarketingModelosVazio,
  MarketingModelosVazioEscuro,
} from "./Modelos";
import {
  MarketingMetricasClaro,
  MarketingMetricasEscuro,
  MarketingMetricasSemRecibos,
  MarketingMetricasSemRecibosEscuro,
} from "./Metricas";
import {
  MarketingCloudClaro,
  MarketingCloudEscuro,
  MarketingCloudVazia,
  MarketingCloudVaziaEscuro,
} from "./Cloud";

/**
 * Canvas do Marketing — pela ordem do menu
 * =========================================================================
 * A área `/marketing` nasceu na Fase 10, por decisão do cliente de 13 out 2026
 * (07 §24.6): o Suporte responde a uma pessoa que pediu ajuda, o Marketing fala
 * com um público. **A ordem vertical segue `MARKETING_NAV`**
 * (`apps/interno/src/lib/navigation.ts`): Atualizações, Campanhas, Modelos de
 * e-mail, Métricas de e-mail, SEO, Cloud interna. Percorrer o canvas de cima a baixo é percorrer o
 * menu de cima a baixo, como nos canvases do Admin, do Suporte e do
 * Proprietário.
 *
 * Este canvas é o destino que a nota de topo do `04 - suporte` prometia: as
 * Atualizações, as Campanhas e as Métricas saíram de lá quando esta área
 * nasceu.
 *
 * **O SEO não tem storyboard, e isso é a resposta certa para hoje.** A entrada
 * está no menu desde P10-07 e a rota `/marketing/seo` dá 404 — é a "segunda
 * porta" de 07 §24.5 e §24.6, que reaproveita o `SeoManager` de `/admin/seo`
 * com verificação de papel, e ainda não foi construída. Uma storyboard de um
 * ecrã que não existe seria UI escrita dentro da pasta do canvas: é o erro que
 * já custou as storyboards do Proprietário na Fase 4. Entra quando a rota
 * existir — e, quando entrar, fica entre as Métricas e a Cloud.
 *
 * **Os Modelos de e-mail entraram a 21 out 2026**, entre as Campanhas e as
 * Métricas, e com eles tudo o que estava abaixo desceu: a ordem do canvas é a
 * do menu, e o menu pô-los aí porque as Campanhas falam a um público e os
 * Modelos a uma pessoa.
 *
 * Claro à esquerda (`x: 0`), escuro à direita (`x: 1520`), e os estados do
 * mesmo ecrã por baixo do par a que pertencem. Sem `intrinsicSizing`: o
 * enquadramento é um viewport de monitor e o conteúdo rola lá dentro, como num
 * ecrã a sério.
 *
 * ---------------------------------------------------------------------------
 * NOTA DE PROCESSO — este ficheiro não foi criado pelo `canvas_create`
 * ---------------------------------------------------------------------------
 * A 21 out 2026, com autorização expressa do cliente. O devserver do canvas
 * anuncia-se na pasta onde vive e a sondagem da app espera a raiz do workspace
 * (`probe:project_root_diagnostic_mismatch`, a cada 5 segundos); nunca é aceite
 * como saudável, e os servidores MCP do Tempo reiniciam à espera dele. Sem eles
 * não há `canvas_create`.
 *
 * O que ficou por fazer, e é por isso que está escrito aqui: **não houve
 * `canvas_screenshot` nem `canvas_validate`**. O que garante este ficheiro é o
 * `pnpm gate:canvas` — que o compila contra os componentes de hoje — e o `tsc`.
 * A verificação visual foi feita pelo cliente, no canvas aberto na app.
 */
export default function MarketingCanvas() {
  return (
    <Canvas name="05 - marketing" backgroundColor="#232323">
      {/* Atualizações — 1.ª entrada do menu (P10-07) */}
      <Storyboard
        id="MarketingAtualizacoesClaro"
        name="Atualizações · Claro (/marketing/atualizacoes)"
        component={MarketingAtualizacoesClaro}
        layout={{ x: 0, y: 0, width: 1440, height: 1000 }}
      />
      <Storyboard
        id="MarketingAtualizacoesEscuro"
        name="Atualizações · Escuro (/marketing/atualizacoes)"
        component={MarketingAtualizacoesEscuro}
        layout={{ x: 1520, y: 0, width: 1440, height: 1000 }}
      />

      {/* O primeiro dia da área: ainda não há nenhuma novidade escrita */}
      <Storyboard
        id="MarketingAtualizacoesVazio"
        name="Atualizações · Sem novidades · Claro"
        component={MarketingAtualizacoesVazio}
        layout={{ x: 0, y: 1080, width: 1440, height: 700 }}
      />
      <Storyboard
        id="MarketingAtualizacoesVazioEscuro"
        name="Atualizações · Sem novidades · Escuro"
        component={MarketingAtualizacoesVazioEscuro}
        layout={{ x: 1520, y: 1080, width: 1440, height: 700 }}
      />

      {/* Campanhas — 2.ª entrada do menu (P10-08 · P10-09) */}
      <Storyboard
        id="MarketingCampanhasClaro"
        name="Campanhas · Claro (/marketing/campanhas)"
        component={MarketingCampanhasClaro}
        layout={{ x: 0, y: 1860, width: 1440, height: 900 }}
      />
      <Storyboard
        id="MarketingCampanhasEscuro"
        name="Campanhas · Escuro (/marketing/campanhas)"
        component={MarketingCampanhasEscuro}
        layout={{ x: 1520, y: 1860, width: 1440, height: 900 }}
      />

      {/* P10-08 — o construtor a construir, que é o estado em que se usa.
          Entrou a 22 out 2026: o par acima está `sent`, e `sent` tranca o
          ecrã todo. Até aqui o canvas só tinha o depois. */}
      <Storyboard
        id="MarketingCampanhasConstrutor"
        name="Campanhas · Construtor (rascunho) · Claro"
        component={MarketingCampanhasConstrutor}
        layout={{ x: 0, y: 2840, width: 1440, height: 900 }}
      />
      <Storyboard
        id="MarketingCampanhasConstrutorEscuro"
        name="Campanhas · Construtor (rascunho) · Escuro"
        component={MarketingCampanhasConstrutorEscuro}
        layout={{ x: 1520, y: 2840, width: 1440, height: 900 }}
      />

      {/* P10-09 — o agendamento que não disparou, atrás do botão do cabeçalho */}
      <Storyboard
        id="MarketingCampanhasAgendamentoFalhado"
        name="Campanhas · Agendamento falhado · Claro"
        component={MarketingCampanhasAgendamentoFalhado}
        layout={{ x: 0, y: 3820, width: 1440, height: 900 }}
      />
      <Storyboard
        id="MarketingCampanhasAgendamentoFalhadoEscuro"
        name="Campanhas · Agendamento falhado · Escuro"
        component={MarketingCampanhasAgendamentoFalhadoEscuro}
        layout={{ x: 1520, y: 3820, width: 1440, height: 900 }}
      />

      {/* O ecrã de quem acaba de entrar: a lista à vista, nada aberto */}
      <Storyboard
        id="MarketingCampanhasSemSelecao"
        name="Campanhas · Sem campanha aberta · Claro"
        component={MarketingCampanhasSemSelecao}
        layout={{ x: 0, y: 4800, width: 1440, height: 900 }}
      />
      <Storyboard
        id="MarketingCampanhasSemSelecaoEscuro"
        name="Campanhas · Sem campanha aberta · Escuro"
        component={MarketingCampanhasSemSelecaoEscuro}
        layout={{ x: 1520, y: 4800, width: 1440, height: 900 }}
      />

      {/* Modelos de e-mail — 3.ª entrada do menu (21 out 2026).
          O texto aprovado que toda a equipa usa para responder: o Marketing
          escreve aqui, o Suporte insere-o no compositor. */}
      <Storyboard
        id="MarketingModelosClaro"
        name="Modelos de e-mail · Claro (/marketing/modelos)"
        component={MarketingModelosClaro}
        layout={{ x: 0, y: 5780, width: 1440, height: 900 }}
      />
      <Storyboard
        id="MarketingModelosEscuro"
        name="Modelos de e-mail · Escuro (/marketing/modelos)"
        component={MarketingModelosEscuro}
        layout={{ x: 1520, y: 5780, width: 1440, height: 900 }}
      />

      {/* O primeiro dia: ainda não há modelo nenhum escrito */}
      <Storyboard
        id="MarketingModelosVazio"
        name="Modelos de e-mail · Sem modelos · Claro"
        component={MarketingModelosVazio}
        layout={{ x: 0, y: 6760, width: 1440, height: 700 }}
      />
      <Storyboard
        id="MarketingModelosVazioEscuro"
        name="Modelos de e-mail · Sem modelos · Escuro"
        component={MarketingModelosVazioEscuro}
        layout={{ x: 1520, y: 6760, width: 1440, height: 700 }}
      />

      {/* Métricas de e-mail — 4.ª entrada do menu (P10-10) */}
      <Storyboard
        id="MarketingMetricasClaro"
        name="Métricas de e-mail · Claro (/marketing/metricas)"
        component={MarketingMetricasClaro}
        layout={{ x: 0, y: 7540, width: 1440, height: 900 }}
      />
      <Storyboard
        id="MarketingMetricasEscuro"
        name="Métricas de e-mail · Escuro (/marketing/metricas)"
        component={MarketingMetricasEscuro}
        layout={{ x: 1520, y: 7540, width: 1440, height: 900 }}
      />

      {/* O estado real de hoje: campanhas enviadas e zero recibos */}
      <Storyboard
        id="MarketingMetricasSemRecibos"
        name="Métricas de e-mail · Sem recibos (webhook por apontar) · Claro"
        component={MarketingMetricasSemRecibos}
        layout={{ x: 0, y: 8520, width: 1440, height: 900 }}
      />
      <Storyboard
        id="MarketingMetricasSemRecibosEscuro"
        name="Métricas de e-mail · Sem recibos (webhook por apontar) · Escuro"
        component={MarketingMetricasSemRecibosEscuro}
        layout={{ x: 1520, y: 8520, width: 1440, height: 900 }}
      />

      {/* Cloud interna — 6.ª entrada do menu (P10-10). A 5.ª, o SEO, não tem
          rota: ver a nota de topo. */}
      <Storyboard
        id="MarketingCloudClaro"
        name="Cloud interna · Claro (/marketing/cloud)"
        component={MarketingCloudClaro}
        layout={{ x: 0, y: 9500, width: 1440, height: 900 }}
      />
      <Storyboard
        id="MarketingCloudEscuro"
        name="Cloud interna · Escuro (/marketing/cloud)"
        component={MarketingCloudEscuro}
        layout={{ x: 1520, y: 9500, width: 1440, height: 900 }}
      />

      {/* O primeiro dia da gaveta da equipa */}
      <Storyboard
        id="MarketingCloudVazia"
        name="Cloud interna · Gaveta vazia · Claro"
        component={MarketingCloudVazia}
        layout={{ x: 0, y: 10480, width: 1440, height: 700 }}
      />
      <Storyboard
        id="MarketingCloudVaziaEscuro"
        name="Cloud interna · Gaveta vazia · Escuro"
        component={MarketingCloudVaziaEscuro}
        layout={{ x: 1520, y: 10480, width: 1440, height: 700 }}
      />
    </Canvas>
  );
}
