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
const VARIABLE_LABELS: Record<string, string> = {
  proprietario: "Proprietário",
  comprador: "Comprador",
  inquilino: "Inquilino",
  imovel: "Imóvel",
  morada: "Morada",
  preco: "Preço",
  renda: "Renda",
  prazo: "Prazo",
  data: "Data",
};

function variableLabel(name: string) {
  return VARIABLE_LABELS[name] ?? name.charAt(0).toUpperCase() + name.slice(1);
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
    const label = String(node.attrs.label ?? "") || variableLabel(name);
    return ["span", mergeAttributes(HTMLAttributes, { class: "upm-chip" }), `[ ${label} ]`];
  },
  renderText({ node }) {
    const name = String(node.attrs.name ?? "");
    return `[ ${String(node.attrs.label ?? "") || variableLabel(name)} ]`;
  },
});

export function TemplateBodyEditor({
  label,
  name,
  initialContent,
  variables,
  editable = true,
}: Props) {
  const [document, setDocument] = useState(isDocument(initialContent) ? initialContent : EMPTY_DOCUMENT);
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
    onUpdate: ({ editor: currentEditor }) => setDocument(currentEditor.getJSON() as typeof document),
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
        <div className={styles.toolbar} aria-label="Ferramentas de formatação">
          <div className={styles.styleSelect}>
            <Select
              label="Estilo de texto"
              labelHidden
              value={editor?.isActive("heading", { level: 1 }) ? "h1" : editor?.isActive("heading", { level: 2 }) ? "h2" : editor?.isActive("heading", { level: 3 }) ? "h3" : "p"}
              disabled={!editor || !editable}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "p") editor?.chain().focus().setParagraph().run();
                else if (value.startsWith("h")) {
                  editor?.chain().focus().setHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 }).run();
                }
              }}
              options={[
                { value: "p", label: "Texto normal" },
                { value: "h1", label: "Título" },
                { value: "h2", label: "Secção" },
                { value: "h3", label: "Subsecção" },
              ]}
            />
          </div>
          <ToolButton label="Negrito" active={Boolean(editor?.isActive("bold"))} disabled={!editor || !editable} onClick={() => editor?.chain().focus().toggleBold().run()}>
            <Bold size={15} />
          </ToolButton>
          <ToolButton label="Itálico" active={Boolean(editor?.isActive("italic"))} disabled={!editor || !editable} onClick={() => editor?.chain().focus().toggleItalic().run()}>
            <Italic size={15} />
          </ToolButton>
          <ToolButton label="Sublinhado" active={Boolean(editor?.isActive("underline"))} disabled={!editor || !editable} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
            <UnderlineIcon size={15} />
          </ToolButton>
          <span className={styles.separator} aria-hidden="true" />
          <ToolButton label="Alinhar à esquerda" active={Boolean(editor?.isActive({ textAlign: "left" }))} disabled={!editor || !editable} onClick={() => editor?.chain().focus().setTextAlign("left").run()}>
            <AlignLeft size={15} />
          </ToolButton>
          <ToolButton label="Centrar" active={Boolean(editor?.isActive({ textAlign: "center" }))} disabled={!editor || !editable} onClick={() => editor?.chain().focus().setTextAlign("center").run()}>
            <AlignCenter size={15} />
          </ToolButton>
          <ToolButton label="Alinhar à direita" active={Boolean(editor?.isActive({ textAlign: "right" }))} disabled={!editor || !editable} onClick={() => editor?.chain().focus().setTextAlign("right").run()}>
            <AlignRight size={15} />
          </ToolButton>
          <span className={styles.separator} aria-hidden="true" />
          <ToolButton label="Lista com marcas" active={Boolean(editor?.isActive("bulletList"))} disabled={!editor || !editable} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
            <List size={15} />
          </ToolButton>
          <ToolButton label="Lista numerada" active={Boolean(editor?.isActive("orderedList"))} disabled={!editor || !editable} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
            <ListOrdered size={15} />
          </ToolButton>
          <ToolButton label="Inserir tabela" active={Boolean(editor?.isActive("table"))} disabled={!editor || !editable} onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
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
              aria-label="Adicionar variável"
              aria-expanded={variableMenuOpen}
              aria-controls={variableMenuOpen ? variablePopoverId : undefined}
              disabled={!editor || !editable}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setVariableMenuOpen((open) => !open)}
            >
              <Plus size={16} strokeWidth={2.5} />
            </Button>
            {variableMenuOpen && editable && (
              <div id={variablePopoverId} className={styles.variablePopover} aria-label="Inserir variável" role="group">
                <span className={styles.variablePopoverTitle}>Inserir variável</span>
                {variables.length === 0 ? (
                  <p className={styles.emptyVariables}>
                    Adicione variáveis no campo acima para as inserir no texto.
                  </p>
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
                          editor?.chain().focus().insertContent({
                            type: "variable",
                            attrs: { name: variable, label: variableLabel(variable) },
                          }).run();
                          setVariableMenuOpen(false);
                        }}
                      >
                        {variableLabel(variable)}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        {variables.length === 0 && editable && (
          <p className={styles.hint}>Adicione variáveis acima para as poder inserir no texto.</p>
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
