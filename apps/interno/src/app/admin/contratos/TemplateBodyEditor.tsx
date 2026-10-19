"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { mergeAttributes, Node as TiptapNode } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  List,
  ListOrdered,
  Plus,
  Table as TableIcon,
  Underline as UnderlineIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, Select } from "@upm/ui";
import styles from "./TemplateBodyEditor.module.css";

type DocNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
};

type Props = {
  label: string;
  name: string;
  initialContent: unknown;
  variables: string[];
  editable?: boolean;
};

const EMPTY_DOCUMENT = { type: "doc", content: [{ type: "paragraph" }] };
/**
 * As variáveis que têm rótulo em `editor.variables.*`. O administrador pode
 * escrever qualquer nome no campo das variáveis, logo há sempre nomes sem
 * rótulo — e `t()` de uma chave que não existe imprime a chave.
 */
const VARIAVEIS_COM_ROTULO = new Set([
  "proprietario",
  "comprador",
  "inquilino",
  "imovel",
  "morada",
  "preco",
  "renda",
  "prazo",
  "data",
]);

/** Sem rótulo conhecido, o nome com a primeira letra em maiúscula. */
function nomeEmRotulo(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function isDocument(value: unknown): value is { type: "doc"; content?: DocNode[] } {
  return Boolean(value && typeof value === "object" && (value as DocNode).type === "doc");
}

const TemplateVariable = TiptapNode.create({
  name: "variable",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      name: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-variable") ?? "",
        renderHTML: (attributes) => ({ "data-variable": attributes.name as string }),
      },
      label: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-label") ?? "",
        renderHTML: (attributes) => ({ "data-label": attributes.label as string }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-variable]" }];
  },
  renderHTML({ HTMLAttributes, node }) {
    const name = String(node.attrs.name ?? "");
    // Sem tradução de propósito: o rótulo que conta é o que ficou guardado
    // no documento quando a variável foi inserida. Um contrato assinado não
    // muda de palavras por alguém trocar o idioma do painel.
    const label = String(node.attrs.label ?? "") || nomeEmRotulo(name);
    return ["span", mergeAttributes(HTMLAttributes, { class: "upm-chip" }), label];
  },
  renderText({ node }) {
    const name = String(node.attrs.name ?? "");
    return String(node.attrs.label ?? "") || nomeEmRotulo(name);
  },
});

export function TemplateBodyEditor({
  label,
  name,
  initialContent,
  variables,
  editable = true,
}: Props) {
  /**
   * O namespace é o do editor partilhado, de propósito: as etiquetas da barra
   * são as mesmas — negrito é negrito nos dois — e inventar aqui um segundo
   * "Itálico" era garantir que um dia ficavam diferentes. Quando D68 trouxer
   * este editor para o `@upm/ui/editor`, as chaves já são as certas.
   */
  const t = useTranslations("editor");
  const tVar = useTranslations("editor.variables");
  /** O rótulo que se mostra e que se guarda ao inserir, no idioma do painel. */
  const rotulo = (nome: string) =>
    VARIAVEIS_COM_ROTULO.has(nome) ? tVar(nome) : nomeEmRotulo(nome);
  const [document, setDocument] = useState(
    isDocument(initialContent) ? initialContent : EMPTY_DOCUMENT,
  );
  const [, setSelectionVersion] = useState(0);
  const [variableMenuOpen, setVariableMenuOpen] = useState(false);
  const variablePopoverId = useId();
  const variableInsertRef = useRef<HTMLDivElement>(null);
  const extensions = useMemo(
    () => [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      TemplateVariable,
    ],
    [],
  );
  const editor = useEditor({
    extensions,
    content: document as never,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) =>
      setDocument(currentEditor.getJSON() as typeof document),
    onSelectionUpdate: () => setSelectionVersion((version) => version + 1),
  });
  useEffect(() => {
    editor?.setEditable(editable);
  }, [editable, editor]);
  useEffect(() => {
    if (!variableMenuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && !variableInsertRef.current?.contains(target)) {
        setVariableMenuOpen(false);
      }
    };
    window.document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => window.document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [variableMenuOpen]);

  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      <div className={styles.editor} data-readonly={!editable || undefined}>
        <div className={styles.toolbar} aria-label={t("toolbar")}>
          <div className={styles.styleSelect}>
            <Select
              label={t("textStyle")}
              labelHidden
              value={
                editor?.isActive("heading", { level: 1 })
                  ? "h1"
                  : editor?.isActive("heading", { level: 2 })
                    ? "h2"
                    : editor?.isActive("heading", { level: 3 })
                      ? "h3"
                      : "p"
              }
              disabled={!editor || !editable}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "p") editor?.chain().focus().setParagraph().run();
                else if (value.startsWith("h")) {
                  editor
                    ?.chain()
                    .focus()
                    .setHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 })
                    .run();
                }
              }}
              options={[
                { value: "p", label: t("styleParagraph") },
                { value: "h1", label: t("styleTitle") },
                { value: "h2", label: t("styleSection") },
                { value: "h3", label: t("styleSubsection") },
              ]}
            />
          </div>
          <ToolButton
            label={t("bold")}
            active={Boolean(editor?.isActive("bold"))}
            disabled={!editor || !editable}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <Bold size={15} />
          </ToolButton>
          <ToolButton
            label={t("italic")}
            active={Boolean(editor?.isActive("italic"))}
            disabled={!editor || !editable}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <Italic size={15} />
          </ToolButton>
          <ToolButton
            label={t("underline")}
            active={Boolean(editor?.isActive("underline"))}
            disabled={!editor || !editable}
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon size={15} />
          </ToolButton>
          <span className={styles.separator} aria-hidden="true" />
          <ToolButton
            label={t("alignLeft")}
            active={Boolean(editor?.isActive({ textAlign: "left" }))}
            disabled={!editor || !editable}
            onClick={() => editor?.chain().focus().setTextAlign("left").run()}
          >
            <AlignLeft size={15} />
          </ToolButton>
          <ToolButton
            label={t("alignCenter")}
            active={Boolean(editor?.isActive({ textAlign: "center" }))}
            disabled={!editor || !editable}
            onClick={() => editor?.chain().focus().setTextAlign("center").run()}
          >
            <AlignCenter size={15} />
          </ToolButton>
          <ToolButton
            label={t("alignRight")}
            active={Boolean(editor?.isActive({ textAlign: "right" }))}
            disabled={!editor || !editable}
            onClick={() => editor?.chain().focus().setTextAlign("right").run()}
          >
            <AlignRight size={15} />
          </ToolButton>
          <span className={styles.separator} aria-hidden="true" />
          <ToolButton
            label={t("bullets")}
            active={Boolean(editor?.isActive("bulletList"))}
            disabled={!editor || !editable}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            <List size={15} />
          </ToolButton>
          <ToolButton
            label={t("numbers")}
            active={Boolean(editor?.isActive("orderedList"))}
            disabled={!editor || !editable}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered size={15} />
          </ToolButton>
          <ToolButton
            label={t("insertTable")}
            active={Boolean(editor?.isActive("table"))}
            disabled={!editor || !editable}
            onClick={() =>
              editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
            }
          >
            <TableIcon size={15} />
          </ToolButton>
        </div>
        <div className={styles.contentArea}>
          <EditorContent editor={editor} className={styles.content} aria-label={label} />
          <div ref={variableInsertRef} className={styles.variableInsert}>
            <Button
              type="button"
              className={styles.addVariableButton}
              iconOnly
              aria-label={t("addVariable")}
              aria-expanded={variableMenuOpen}
              aria-controls={variableMenuOpen ? variablePopoverId : undefined}
              disabled={!editor || !editable}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setVariableMenuOpen((open) => !open)}
            >
              <Plus size={16} strokeWidth={2.5} />
            </Button>
            {variableMenuOpen && editable && (
              <div
                id={variablePopoverId}
                className={styles.variablePopover}
                aria-label={t("insertVariableTitle")}
                role="group"
              >
                <span className={styles.variablePopoverTitle}>{t("insertVariableTitle")}</span>
                {variables.length === 0 ? (
                  <p className={styles.emptyVariables}>{t("variablesEmptyPopover")}</p>
                ) : (
                  <div className={styles.variableOptions}>
                    {variables.map((variable) => (
                      <Button
                        key={variable}
                        type="button"
                        variant="ghost"
                        className={styles.variableOption}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          editor
                            ?.chain()
                            .focus()
                            .insertContent({
                              type: "variable",
                              attrs: { name: variable, label: rotulo(variable) },
                            })
                            .run();
                          setVariableMenuOpen(false);
                        }}
                      >
                        {rotulo(variable)}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        {variables.length === 0 && editable && (
          <p className={styles.hint}>{t("variablesEmptyHint")}</p>
        )}
      </div>
      <input type="hidden" name={name} value={JSON.stringify(document)} />
    </div>
  );
}

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="sm"
      iconOnly
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
