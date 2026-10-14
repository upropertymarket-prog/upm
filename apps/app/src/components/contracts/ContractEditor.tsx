"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
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
  ChevronLeft,
  ChevronRight,
  Download,
  Italic,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  Share2,
  Table as TableIcon,
  Underline as UnderlineIcon,
} from "lucide-react";
import { Button, Card, Input, Select, StatusTag, Tabs, useToast } from "@upm/ui";
import {
  CONTRACT_STATUSES,
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_TONES,
  CONTRACT_KIND_LABELS,
  canAdvanceContract,
  type ContractStatus,
  type SharePermission,
} from "@upm/db/cloud";

import type { ShareContact } from "../cloud/cloudTypes";
import {
  formatDateTime,
  variableLabel,
  type ContractDetail,
  type ContractHistoryRow,
} from "./contractTypes";
import { Variable, substituteVariables } from "./VariableNode";
import { ShareContractModal, type ContractShareState } from "./ShareContractModal";
import "./contract-editor.css";

/** A4 na proporção 1 : 1,414, à largura da coluna de edição. */
const PAGE_WIDTH = 720;
const PAGE_HEIGHT = Math.round(PAGE_WIDTH * 1.414);

/** 07 §13.2 — "após 5 min de inatividade" fecha-se a sessão de edição. */
const AUTOSAVE_MS = 5 * 60 * 1000;

export type ContractEditorProps = {
  contract: ContractDetail;
  history: ContractHistoryRow[];
  contacts: ShareContact[];
  shares: ContractShareState[];
  onSave: (input: {
    contractId: string;
    body: unknown;
    values: Record<string, string>;
    note?: string;
  }) => Promise<{ error?: string }>;
  onSetStatus: (
    contractId: string,
    status: ContractStatus,
    from: ContractStatus,
  ) => Promise<{ error?: string }>;
  onShare: (input: {
    contractId: string;
    permission: SharePermission;
    sharedWith?: string;
    asLink?: boolean;
    expiresInHours?: number | null;
    accessCode?: string;
  }) => Promise<{ ok?: boolean; url?: string; error?: string }>;
  onRevokeShare: (shareId: string) => Promise<{ error?: string }>;
  onLogExport: (contractId: string) => Promise<void>;
  onBack: () => void;
};

const EXTENSIONS = [
  StarterKit,
  Underline,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  Variable,
];

/**
 * Contract Editor — `/contratos` (P6-03 · 04 §8.3)
 * =========================================================================
 * A barra de estado em cima (modo foco, título, tipo, autosave), a alternância
 * **Editar / Pré-visualizar**, a toolbar, o documento ao centro e, à direita, o
 * que o documento não é: os valores das variáveis, o ciclo de estados e o
 * histórico.
 *
 * Três coisas que vale a pena ler antes de mexer:
 *
 * 1. **A pré-visualização não é o editor com as variáveis escondidas.** É um
 *    segundo documento, com as variáveis já substituídas
 *    (`substituteVariables`). É esse que se pagina e é esse que se imprime —
 *    imprimir o editor imprimiria "Preço" onde devia estar o preço.
 * 2. **Guardar cria versão** (07 §13.2), por isso não se guarda a cada tecla:
 *    guarda-se ao pedir, ao mudar de estado, e ao fim de 5 minutos parado.
 * 3. **O estado não anda para trás.** O `Select` só oferece o que está à frente
 *    — e a função SQL recusa na mesma, que é onde a regra tem de viver.
 */
export function ContractEditor(props: ContractEditorProps) {
  const { contract } = props;
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [focus, setFocus] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(contract.values);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [share, setShare] = useState(false);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [pending, startTransition] = useTransition();
  const pageRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();

  const editor = useEditor({
    extensions: EXTENSIONS,
    content: (contract.body ?? { type: "doc", content: [] }) as never,
    immediatelyRender: false,
    onUpdate: () => setDirty(true),
  });

  const preview = useEditor({
    extensions: EXTENSIONS,
    editable: false,
    immediatelyRender: false,
    content: substituteVariables(contract.body, contract.values) as never,
  });

  const save = useCallback(
    (note?: string) => {
      if (!editor) return;
      const body = editor.getJSON();
      startTransition(async () => {
        const result = await props.onSave({ contractId: contract.id, body, values, note });
        if (result.error) {
          toast(result.error, "error");
          return;
        }
        setDirty(false);
        setSavedAt(new Date());
      });
    },
    [editor, values, contract.id, props, toast],
  );

  /** 07 §13.2 — a sessão de edição fecha-se sozinha ao fim de 5 min parada. */
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => save("Guardado automaticamente"), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [dirty, save]);

  /** A pré-visualização acompanha o que está a ser escrito e preenchido. */
  useEffect(() => {
    if (!preview || !editor || mode !== "preview") return;
    preview.commands.setContent(substituteVariables(editor.getJSON(), values) as never);
  }, [mode, preview, editor, values]);

  /** Quantas folhas A4 o documento ocupa — a paginação de 04 §8.3. */
  useEffect(() => {
    if (mode !== "preview") return;
    const height = pageRef.current?.scrollHeight ?? 0;
    const count = Math.max(1, Math.ceil(height / PAGE_HEIGHT));
    setPageCount(count);
    setPage((current) => Math.min(current, count));
  }, [mode, values, preview]);

  const usedVariables = useMemo(
    () => (contract.variables.length > 0 ? contract.variables : Object.keys(values)),
    [contract.variables, values],
  );

  const nextStatuses = CONTRACT_STATUSES.filter((status) =>
    canAdvanceContract(contract.status, status),
  );

  function exportPdf() {
    setMode("preview");
    startTransition(async () => {
      await props.onLogExport(contract.id);
      // Deixar o modo de pré-visualização pintar antes de chamar a impressão:
      // imprimir o editor sairia com os chips em vez dos valores.
      setTimeout(() => window.print(), 120);
    });
  }

  const body = (
    <div className="upm-contract" style={{ display: "grid", gap: "var(--sp-6)" }}>
      {/* Barra de estado — 04 §8.3 */}
      <Card
        padded
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-4)",
          flexWrap: "wrap",
        }}
      >
        <Button
          variant="ghost"
          iconOnly
          aria-label={focus ? "Sair do modo foco" : "Modo foco"}
          onClick={() => setFocus((value) => !value)}
        >
          {focus ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </Button>
        <div style={{ display: "grid", minWidth: 0, flex: 1 }}>
          <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {contract.title}
          </strong>
          <span style={{ color: "var(--muted)" }}>
            Contrato · {CONTRACT_KIND_LABELS[contract.kind]} ·{" "}
            {dirty
              ? "Alterações por guardar"
              : savedAt
                ? `Guardado às ${savedAt.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}`
                : `Versão ${contract.currentVersion}`}
          </span>
        </div>

        <Tabs
          label="Modo do editor"
          value={mode}
          onValueChange={(next) => setMode(next as "edit" | "preview")}
          items={[
            { id: "edit", label: "Editar" },
            { id: "preview", label: "Pré-visualizar" },
          ]}
        />

        <div style={{ display: "flex", gap: "var(--sp-3)" }}>
          <Button size="sm" disabled={pending || !dirty} onClick={() => save()}>
            Guardar
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Download size={15} />}
            onClick={exportPdf}
          >
            Exportar PDF
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Share2 size={15} />}
            onClick={() => setShare(true)}
          >
            Partilhar
          </Button>
        </div>
      </Card>

      {/* Folha + painel de variáveis. Abaixo de 900 px o painel passa para
          baixo da folha: ao lado, sobrava-lhe menos de 100 px de largura. */}
      <div
        className="upm-split"
        style={
          {
            "--split-cols": "minmax(0, 1fr) minmax(240px, 300px)",
            "--split-gap": "var(--sp-6)",
          } as React.CSSProperties
        }
      >
        <div style={{ display: "grid", gap: "var(--sp-4)", minWidth: 0 }}>
          {mode === "edit" ? (
            <>
              <Toolbar editor={editor} variables={usedVariables} />
              <div className="upm-contract__surface">
                <EditorContent editor={editor} />
              </div>
            </>
          ) : (
            <>
              <div
                className="upm-contract__pages upm-contract__print"
                style={{ height: PAGE_HEIGHT, maxWidth: PAGE_WIDTH }}
              >
                <div
                  ref={pageRef}
                  className="upm-contract__pageview"
                  style={{
                    transform: `translateY(-${(page - 1) * PAGE_HEIGHT}px)`,
                    padding: "var(--sp-8) var(--sp-9)",
                  }}
                >
                  <EditorContent editor={preview} />
                </div>
              </div>

              {/* Setas e números — 04 §8.3. */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--sp-3)",
                  justifyContent: "center",
                }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  aria-label="Página anterior"
                  disabled={page === 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  <ChevronLeft size={15} />
                </Button>
                {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
                  <Button
                    key={number}
                    variant={number === page ? "primary" : "ghost"}
                    size="sm"
                    onClick={() => setPage(number)}
                    aria-current={number === page ? "page" : undefined}
                  >
                    {number}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  aria-label="Página seguinte"
                  disabled={page === pageCount}
                  onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
                >
                  <ChevronRight size={15} />
                </Button>
              </div>
            </>
          )}
        </div>

        <div
          style={{ display: "grid", gap: "var(--sp-6)", position: "sticky", top: "var(--sp-6)" }}
        >
          <Card padded style={{ display: "grid", gap: "var(--sp-4)" }}>
            <strong>Dados do contrato</strong>
            {usedVariables.length === 0 ? (
              <span style={{ color: "var(--muted)" }}>Este modelo não tem variáveis.</span>
            ) : (
              usedVariables.map((name) => (
                <Input
                  key={name}
                  label={variableLabel(name)}
                  value={values[name] ?? ""}
                  onChange={(event) => {
                    setValues((current) => ({ ...current, [name]: event.target.value }));
                    setDirty(true);
                  }}
                />
              ))
            )}
          </Card>

          <Card padded style={{ display: "grid", gap: "var(--sp-4)" }}>
            <strong>Estado</strong>
            <StatusTag tone={CONTRACT_STATUS_TONES[contract.status] as never}>
              {CONTRACT_STATUS_LABELS[contract.status]}
            </StatusTag>
            {nextStatuses.length === 0 ? (
              <span style={{ color: "var(--muted)" }}>O ciclo está concluído.</span>
            ) : (
              <Select
                label="Avançar para"
                labelHidden
                value=""
                placeholder="Avançar para…"
                onChange={(event) => {
                  const next = event.target.value as ContractStatus;
                  if (!next) return;
                  startTransition(async () => {
                    if (dirty)
                      await props.onSave({
                        contractId: contract.id,
                        body: editor?.getJSON(),
                        values,
                      });
                    const result = await props.onSetStatus(contract.id, next, contract.status);
                    if (result.error) toast(result.error, "error");
                    else {
                      setDirty(false);
                      toast(`Contrato marcado como "${CONTRACT_STATUS_LABELS[next]}".`, "success");
                    }
                  });
                }}
                options={nextStatuses.map((status) => ({
                  value: status,
                  label: CONTRACT_STATUS_LABELS[status],
                }))}
                hint="O estado de um contrato não anda para trás."
              />
            )}
          </Card>

          <Card padded style={{ display: "grid", gap: "var(--sp-4)" }}>
            <strong>Histórico</strong>
            {props.history.length === 0 ? (
              <span style={{ color: "var(--muted)" }}>Ainda sem versões guardadas.</span>
            ) : (
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                  display: "grid",
                  gap: "var(--sp-3)",
                }}
              >
                {props.history.slice(0, 8).map((entry) => (
                  <li key={entry.version} style={{ display: "grid" }}>
                    <span>
                      v{entry.version}
                      {entry.frozen ? " · congelada" : ""} · {entry.authorName}
                    </span>
                    <span style={{ color: "var(--muted)" }}>
                      {formatDateTime(entry.createdAt)}
                      {entry.note ? ` · ${entry.note}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Button variant="secondary" size="sm" onClick={props.onBack}>
            Voltar aos contratos
          </Button>
        </div>
      </div>

      <ShareContractModal
        open={share}
        contract={contract}
        contacts={props.contacts}
        shares={props.shares}
        onClose={() => setShare(false)}
        onShare={props.onShare}
        onRevoke={props.onRevokeShare}
      />
    </div>
  );

  return focus ? <div className="upm-contract--focus">{body}</div> : body;
}

/**
 * Toolbar — estilo, B/I/U, alinhamentos, listas, tabela e Variável ▾ (04 §8.3).
 *
 * O "tamanho" da referência é aqui o **estilo**: neste documento o tamanho da
 * letra é consequência do nível do título, não uma escolha à parte. Um seletor
 * de tamanhos livres daria contratos com corpo a 11 px e cláusulas a 19 px, e
 * partiria a escala de 04 §1.3 em cada documento.
 */
function Toolbar({ editor, variables }: { editor: Editor | null; variables: string[] }) {
  if (!editor) return null;

  const style = editor.isActive("heading", { level: 1 })
    ? "h1"
    : editor.isActive("heading", { level: 2 })
      ? "h2"
      : editor.isActive("heading", { level: 3 })
        ? "h3"
        : "p";

  return (
    <Card
      padded
      style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", flexWrap: "wrap" }}
    >
      <div style={{ width: 150 }}>
        <Select
          label="Estilo"
          labelHidden
          value={style}
          onChange={(event) => {
            const value = event.target.value;
            const chain = editor.chain().focus();
            if (value === "p") chain.setParagraph().run();
            else chain.setHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 }).run();
          }}
          options={[
            { value: "p", label: "Texto" },
            { value: "h1", label: "Título" },
            { value: "h2", label: "Secção" },
            { value: "h3", label: "Subsecção" },
          ]}
        />
      </div>

      <ToolButton
        label="Negrito"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold size={14} />
      </ToolButton>
      <ToolButton
        label="Itálico"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic size={14} />
      </ToolButton>
      <ToolButton
        label="Sublinhado"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon size={14} />
      </ToolButton>

      <ToolButton
        label="Alinhar à esquerda"
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
      >
        <AlignLeft size={14} />
      </ToolButton>
      <ToolButton
        label="Centrar"
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      >
        <AlignCenter size={14} />
      </ToolButton>
      <ToolButton
        label="Alinhar à direita"
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      >
        <AlignRight size={14} />
      </ToolButton>

      <ToolButton
        label="Lista"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List size={14} />
      </ToolButton>
      <ToolButton
        label="Lista numerada"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={14} />
      </ToolButton>
      <ToolButton
        label="Tabela"
        active={editor.isActive("table")}
        onClick={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
      >
        <TableIcon size={14} />
      </ToolButton>

      <div style={{ width: 170, marginLeft: "auto" }}>
        <Select
          label="Variável"
          labelHidden
          value=""
          placeholder="Variável"
          onChange={(event) => {
            const name = event.target.value;
            if (!name) return;
            editor
              .chain()
              .focus()
              .insertContent({ type: "variable", attrs: { name, label: variableLabel(name) } })
              .run();
          }}
          options={variables.map((name) => ({ value: name, label: variableLabel(name) }))}
        />
      </div>
    </Card>
  );
}

function ToolButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant={active ? "secondary" : "ghost"}
      iconOnly
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
