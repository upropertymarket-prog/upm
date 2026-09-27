/**
 * Narração de canvas — Button (04 §5.4 · 07 §5.14)
 * =========================================================================
 * Harness de storyboard: renderiza o `Button` de produção com props reais, nos
 * dois temas. Nenhum componente novo é definido aqui.
 */
import { Download, Plus, Search } from "lucide-react";

import { Button } from "../../../../packages/ui/src/components/Button";
import { Note, Row, ThemePair } from "../../_narration/ThemePair";

/** Variantes, hover, foco e desativado nos dois temas (critério de P1-04). */
export function Variantes() {
  return (
    <ThemePair>
      <Row label="Primário · fundo --accent, hover --accent-hover">
        <Button leadingIcon={<Plus size={15} />}>Nova propriedade</Button>
        <Button disabled>Desativado</Button>
      </Row>
      <Row label="Secundário · hover passa a borda e texto --accent">
        <Button variant="secondary" leadingIcon={<Download size={15} />}>
          Exportar
        </Button>
        <Button variant="secondary" disabled>
          Desativado
        </Button>
      </Row>
      <Row label="Fantasma · ações terciárias e barras de ferramentas">
        <Button variant="ghost">Cancelar</Button>
        <Button variant="ghost" disabled>
          Desativado
        </Button>
      </Row>
      <Row label="Perigo · contorno, preenche a vermelho no hover">
        <Button variant="danger">Eliminar conta</Button>
        <Button variant="danger" disabled>
          Desativado
        </Button>
      </Row>
      <Note>
        O hover e o foco não se vêem numa captura estática: passe o rato e use o Tab no storyboard.
        O foco é um contorno `--accent` com 2 px de afastamento, igual em todos os componentes (04
        §5.7).
      </Note>
    </ThemePair>
  );
}

/** Tamanhos e a regra dura dos 40 px (07 §5.14). */
export function Tamanhos() {
  return (
    <ThemePair>
      <Row label="sm 40 · md 42 · lg 44">
        <Button size="sm">Pequeno</Button>
        <Button size="md">Médio</Button>
        <Button size="lg">Grande</Button>
      </Row>
      <Row label="Só ícone · 40 × 40 px, sempre com aria-label">
        <Button iconOnly aria-label="Pesquisar">
          <Search size={17} />
        </Button>
        <Button variant="secondary" iconOnly aria-label="Exportar">
          <Download size={17} />
        </Button>
        <Button variant="ghost" iconOnly aria-label="Adicionar">
          <Plus size={17} />
        </Button>
      </Row>
      <Note>
        Nenhum tamanho desce abaixo do alvo de 40 px, nem o `sm`: 07 §5.14 mede a área clicável, não
        o desenho. É por isso que os ícones de hover das listas podem ter 14 px e continuar a
        cumprir a regra.
      </Note>
    </ThemePair>
  );
}
