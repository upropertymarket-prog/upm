"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Card, CardBody, CardHeader, CardTitle, Input, PageHeader, Select } from "@upm/ui";
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
  const t = useTranslations("admin.contractTemplates");
  return state.error ? (
    <p role="alert" className="mt-3 text-sm text-danger">
      {state.error}
    </p>
  ) : state.ok ? (
    <p role="status" className="mt-3 text-sm text-ok">
      {t("saved")}
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
  const t = useTranslations("admin.contractTemplates");
  const tCommon = useTranslations("common");
  // O tipo de contrato é o mesmo conceito dos dois lados do produto: as chaves
  // são as de `contracts.kind`, e não um segundo "Compra e venda" só do Admin.
  const tKind = useTranslations("contracts.kind");
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
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Button
            type="button"
            onClick={() => {
              setCreateVariables("");
              setCreateOpen(true);
            }}
          >
            {t("newTemplate")}
          </Button>
        }
      />
      {createOpen && (
        <Card>
          <CardHeader>
            <CardTitle>{t("newTemplate")}</CardTitle>
          </CardHeader>
          <CardBody>
            <form action={createAction} className="grid gap-4 md:grid-cols-2">
              <Input label={t("name")} name="name" placeholder={t("namePlaceholder")} />
              <Select
                label={t("kind")}
                name="kind"
                options={[
                  { value: "sale", label: tKind("sale") },
                  { value: "rent", label: tKind("rent") },
                ]}
              />
              <Input
                label={t("variables")}
                name="variables"
                value={createVariables}
                onChange={(event) => setCreateVariables(event.target.value)}
                placeholder={t("variablesPlaceholder")}
                hint={t("variablesHintNew")}
              />
              <TemplateBodyEditor
                label={t("body")}
                name="body"
                initialContent={emptyBody}
                variables={parseVariables(createVariables)}
              />
              <div className="flex gap-3 md:col-span-2">
                <Button type="submit">{t("createDraft")}</Button>
                <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                  {tCommon("cancel")}
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
            <CardTitle>{t("listTitle")}</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="space-y-2">
              {templates.length === 0 && <p className="text-sm text-muted">{t("listEmpty")}</p>}
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
                      {t("kindAndVersion", {
                        kind: tKind(template.kind),
                        version: String(template.version),
                      })}
                    </span>
                  </span>
                  <span className="text-[length:var(--fs-body)] text-muted">
                    {t(`status.${template.status}`)}
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
  const t = useTranslations("admin.contractTemplates");
  const [variablesText, setVariablesText] = useState(template.variables.join(", "));
  const [saveState, saveAction] = useActionState(
    (_prev: TemplateActionState, formData: FormData) => actions.saveTemplate(template.id, formData),
    {},
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t("editVersion", { version: String(template.version) })}{" "}
          <span className="text-sm font-normal text-muted">
            ·{" "}
            {template.status === "published"
              ? t("statusInline.published")
              : t("statusInline.draft")}
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody>
        <form action={saveAction} className="space-y-4">
          <Input label={t("name")} name="name" defaultValue={template.name} />
          <Input
            label={t("variables")}
            name="variables"
            value={variablesText}
            onChange={(event) => setVariablesText(event.target.value)}
            hint={t("variablesHint")}
          />
          <TemplateBodyEditor
            label={t("body")}
            name="body"
            initialContent={template.body}
            variables={parseVariables(variablesText)}
            editable={template.status === "draft"}
          />
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={template.status !== "draft"}>
              {t("saveDraft")}
            </Button>
            {template.status === "draft" && (
              <Button type="button" variant="secondary" onClick={() => void onPublish()}>
                {t("publishVersion")}
              </Button>
            )}
            {template.status === "published" && (
              <Button type="button" variant="secondary" onClick={() => void onVersion()}>
                {t("newVersion")}
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
