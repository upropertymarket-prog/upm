/**
 * Narração de canvas — campos de formulário (04 §5.4 · 04 §5.7)
 * =========================================================================
 * Harness de storyboard sobre os componentes de produção. Os estados de erro e
 * desativado aparecem ao lado dos normais de propósito: é onde os design
 * systems costumam ficar incoerentes.
 */
"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import { Checkbox } from "../../../../packages/ui/src/components/Checkbox";
import { Input, Textarea } from "../../../../packages/ui/src/components/Input";
import { Select } from "../../../../packages/ui/src/components/Select";
import { Toggle } from "../../../../packages/ui/src/components/Toggle";
import { Note, Row, ThemePair } from "../../_narration/ThemePair";

const DEAL_OPTIONS = [
  { value: "sale", label: "Venda" },
  { value: "rent", label: "Arrendamento" },
];

function CamposDemo() {
  return (
    <>
      <Row label="Input">
        <div style={{ width: 240 }}>
          <Input label="Título do anúncio" defaultValue="Apartamento T3 com varanda" />
        </div>
        <div style={{ width: 240 }}>
          <Input
            label="Pesquisar"
            leadingIcon={<Search size={16} aria-hidden="true" style={{ stroke: "rgb(100, 116, 139)" }} />}
            placeholder="Referência, localidade…"
          />
        </div>
      </Row>
      <Row label="Com ajuda, com erro e desativado">
        <div style={{ width: 240 }}>
          <Input label="Área bruta" defaultValue="118" hint="Em metros quadrados." />
        </div>
        <div style={{ width: 240 }}>
          <Input label="Preço" defaultValue="0" error="Indique um valor acima de 0 €." />
        </div>
        <div style={{ width: 240 }}>
          <Input label="Referência" defaultValue="UPM-1041" disabled />
        </div>
      </Row>
      <Row label="Select">
        <div style={{ width: 240 }}>
          <Select label="Negócio" options={DEAL_OPTIONS} placeholder="Todos" />
        </div>
        <div style={{ width: 240 }}>
          <Select label="Negócio" options={DEAL_OPTIONS} defaultValue="rent" disabled />
        </div>
      </Row>
      <Row label="Textarea">
        <div style={{ width: 500 }}>
          <Textarea
            label="Descrição do proprietário"
            hint="Máximo 2 000 caracteres."
            defaultValue="Apartamento remodelado em 2019, orientação nascente-poente e varanda de 12 m²."
          />
        </div>
      </Row>
      <Note>
        O label é uma prop obrigatória: 04 §5.7 exige label em todos os inputs, e a única forma de
        garantir isso é tornar impossível escrever um campo sem ele. Quando o desenho não tem espaço
        para o label, usa-se `labelHidden` — o texto continua lá para o leitor de ecrã.
      </Note>
    </>
  );
}

/** Input, Textarea e Select nos dois temas, com erro e desativado. */
export function Campos() {
  return (
    <ThemePair>
      <CamposDemo />
    </ThemePair>
  );
}

function EscolhasDemo() {
  const [aproximada, setAproximada] = useState(true);
  const [destaque, setDestaque] = useState(false);
  const [termos, setTermos] = useState(true);

  return (
    <>
      <Row label="Toggle · aplica na hora">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          <Toggle
            checked={aproximada}
            onCheckedChange={setAproximada}
            label="Mostrar só a localização aproximada"
            hint="A morada exata fica reservada a compradores autorizados (07 §1)."
          />
          <Toggle
            checked={destaque}
            onCheckedChange={setDestaque}
            label="Destacar no Market"
            hint="Ação exclusiva do admin (07 §5.2)."
          />
          <Toggle checked disabled onCheckedChange={() => undefined} label="Desativado" />
        </div>
      </Row>
      <Row label="Checkbox · espera pelo Guardar">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
          <Checkbox
            checked={termos}
            onChange={(event) => setTermos(event.target.checked)}
            label="Aceito os termos e a política de privacidade"
          />
          <Checkbox
            label="Selecionar todos"
            indeterminate
            onChange={() => undefined}
            hint="Terceiro estado, para seleção parcial em tabelas."
          />
          <Checkbox label="Desativado" disabled onChange={() => undefined} />
        </div>
      </Row>
      <Note>
        Toggle e Checkbox não são intermutáveis: o toggle é um `role=&quot;switch&quot;` que aplica
        de imediato (localização aproximada, feature flags); o checkbox é um input de formulário que
        só conta quando se carrega em Guardar.
      </Note>
    </>
  );
}

/** Checkbox e Toggle nos dois temas, incluindo indeterminado e desativado. */
export function Escolhas() {
  return (
    <ThemePair>
      <EscolhasDemo />
    </ThemePair>
  );
}
