"use client";

import { useActionState, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Input,
  PageHeader,
  Select,
} from "@upm/ui";
import { TemplateBodyEditor } from "./TemplateBodyEditor";
export type TemplateActionState = { ok?: boolean; error?: string; id?: string };

type Template = {
  id: string;
  family_id: string;
  name: string;
  kind: "sale" | "rent";
  version: number;
  status: "draft" | "published" | "archived";
  body: unknown;
  variables: string[];
  updated_at: string;
};
const emptyBody = { type: "doc", content: [{ type: "paragraph" }] };

function parseVariables(value: string) {
  return [
    ...new Set(
      value
        .split(/[,\n]/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

function ActionMessage({ state }: { state: TemplateActionState }) {
  return state.error ? (
    <p role="alert" className="mt-3 text-sm text-danger">
      {state.error}
    </p>
  ) : state.ok ? (
    <p role="status" className="mt-3 text-sm text-ok">
      Guardado.
    </p>
  ) : null;
}

export type TemplateManagerActions = {
  createTemplate: (prev: TemplateActionState, formData: FormData) => Promise<TemplateActionState>;
  saveTemplate: (templateId: string, formData: FormData) => Promise<TemplateActionState>;
  startTemplateVersion: (familyId: string) => Promise<TemplateActionState>;
  publishTemplate: (templateId: string) => Promise<TemplateActionState>;
};

export function TemplateManager({
  templates,
  actions,
}: {
  templates: Template[];
  actions: TemplateManagerActions;
}) {
  const [selected, setSelected] = useState(
    templates.find((template) => template.status === "draft")?.id ?? templates[0]?.id ?? "",
  );
  const current = templates.find((template) => template.id === selected) ?? templates[0];
  const [createState, createAction] = useActionState(actions.createTemplate, {});
  const [createOpen, setCreateOpen] = useState(false);
  const [createVariables, setCreateVariables] = useState("");
  const [versionState, setVersionState] = useState<TemplateActionState>({});
  const [publishState, setPublishState] = useState<TemplateActionState>({});

  return (
    <div className="space-y-6">
      <PageHeader
        title="Templates de contrato"
        subtitle="Modelos publicados e versões em preparação"
        actions={
          <Button
            type="button"
            onClick={() => {
              setCreateVariables("");
              setCreateOpen(true);
            }}
          >
            Novo modelo
          </Button>
        }
      />
      {createOpen && (
        <Card>
          <CardHeader>
            <CardTitle>Novo modelo</CardTitle>
          </CardHeader>
          <CardBody>
            <form action={createAction} className="grid gap-4 md:grid-cols-2">
              <Input label="Nome" name="name" placeholder="Contrato de compra e venda" />
              <Select
                label="Tipo"
                name="kind"
                options={[
                  { value: "sale", label: "Compra e venda" },
                  { value: "rent", label: "Arrendamento" },
                ]}
              />
              <Input
                label="Variáveis"
                name="variables"
                value={createVariables}
                onChange={(event) => setCreateVariables(event.target.value)}
                placeholder="proprietario, comprador, imovel, preco"
                hint="Separe por vírgulas; depois insira-as no texto a partir da toolbar."
              />
              <TemplateBodyEditor
                label="Conteúdo do contrato"
                name="body"
                initialContent={emptyBody}
                variables={parseVariables(createVariables)}
              />
              <div className="flex gap-3 md:col-span-2">
                <Button type="submit">Criar rascunho</Button>
                <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </Button>
              </div>
              <ActionMessage state={createState} />
            </form>
          </CardBody>
        </Card>
      )}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Modelos</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="space-y-2">
              {templates.length === 0 && (
                <p className="text-sm text-muted">Ainda não existem modelos.</p>
              )}
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setSelected(template.id)}
                  className={`flex w-full items-center justify-between rounded-xl border p-4 text-left ${template.id === current?.id ? "border-accent bg-accent-soft" : "border-border"}`}
                >
                  <span>
                    <span className="block font-semibold">{template.name}</span>
                    <span className="text-sm text-muted">
                      {template.kind === "sale" ? "Compra e venda" : "Arrendamento"} · v
                      {template.version}
                    </span>
                  </span>
                  <span className="text-xs text-muted">
                    {template.status === "published"
                      ? "Publicado"
                      : template.status === "draft"
                        ? "Rascunho"
                        : "Arquivado"}
                  </span>
                </button>
              ))}
            </div>
          </CardBody>
        </Card>
        {current && (
          <Editor
            key={current.id}
            template={current}
            actions={actions}
            onVersion={async () => {
              const result = await actions.startTemplateVersion(current.family_id);
              setVersionState(result);
              if (result.id) setSelected(result.id);
            }}
            versionState={versionState}
            publishState={publishState}
            onPublish={async () => setPublishState(await actions.publishTemplate(current.id))}
          />
        )}
      </div>
    </div>
  );
}

function Editor({
  template,
  actions,
  onVersion,
  versionState,
  publishState,
  onPublish,
}: {
  template: Template;
  actions: TemplateManagerActions;
  onVersion: () => Promise<void>;
  versionState: TemplateActionState;
  publishState: TemplateActionState;
  onPublish: () => Promise<void>;
}) {
  const [variablesText, setVariablesText] = useState(template.variables.join(", "));
  const [saveState, saveAction] = useActionState(
    (_prev: TemplateActionState, formData: FormData) => actions.saveTemplate(template.id, formData),
    {},
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Editar v{template.version}{" "}
          <span className="text-sm font-normal text-muted">
            · {template.status === "published" ? "publicado" : "rascunho"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody>
        <form action={saveAction} className="space-y-4">
          <Input label="Nome" name="name" defaultValue={template.name} />
          <Input
            label="Variáveis"
            name="variables"
            value={variablesText}
            onChange={(event) => setVariablesText(event.target.value)}
            hint="Separe por vírgulas e insira-as no texto a partir da toolbar."
          />
          <TemplateBodyEditor
            label="Conteúdo do contrato"
            name="body"
            initialContent={template.body}
            variables={parseVariables(variablesText)}
            editable={template.status === "draft"}
          />
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={template.status !== "draft"}>
              Guardar rascunho
            </Button>
            {template.status === "draft" && (
              <Button type="button" variant="secondary" onClick={() => void onPublish()}>
                Publicar versão
              </Button>
            )}
            {template.status === "published" && (
              <Button type="button" variant="secondary" onClick={() => void onVersion()}>
                Criar nova versão
              </Button>
            )}
          </div>
          <ActionMessage state={saveState} />
          <ActionMessage state={versionState} />
          <ActionMessage state={publishState} />
        </form>
      </CardBody>
    </Card>
  );
}
