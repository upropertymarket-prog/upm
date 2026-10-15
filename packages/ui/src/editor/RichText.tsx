"use client";

import { useEffect, useRef } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";

import { Button } from "../components/Button";
import { Variable, type EditorVariable } from "./VariableNode";

// A folha vem com o componente, e não na folha partilhada: assim chega a quem
// monta o editor e **não** ao CSS do site público. Ver a nota do ponto de
// entrada, mais abaixo — e `editor.css`, onde isto está medido.
import "./editor.css";

/**
 * O editor de texto rico do projeto — um, e com uma razão para cada escolha
 * =========================================================================
 * Até 14 out 2026 havia **quatro** editores: dois em TipTap (os contratos, que
 * precisam de documento estruturado, variáveis como nós, paginação e PDF) e
 * dois em `contentEditable` com `execCommand` (o Composer do correio e as
 * Novidades). Os dois últimos eram quase o mesmo ficheiro, e as Campanhas de
 * P10-08 seriam o terceiro. Este componente é o que os substitui.
 *
 * ## Porque TipTap e não `contentEditable`
 *
 * A decisão anterior — `contentEditable` + `execCommand` — defendia-se com
 * "é HTML simples, não vale um editor inteiro". Deixou de se defender por
 * três razões que se somaram:
 *
 * 1. **`execCommand` é obsoleto e inconsistente.** Cada browser produz
 *    marcação diferente para o mesmo clique, e a especificação está morta. É
 *    uma aposta em que ninguém a remova — num editor que o Suporte usa o dia
 *    inteiro para responder a clientes.
 * 2. **As Campanhas precisam de variáveis como chips** (04 §2.6:
 *    `{nome} {apelido} {plano}` com toggle "Com dados"), e isso é um nó de
 *    documento. Com `execCommand` seria texto a fingir que é um campo.
 * 3. **O TipTap já é dependência** de `apps/app` e `apps/interno` por causa
 *    dos contratos (02 §3.2). Não é vendor novo — é parar de ter dois motores.
 *
 * ## Porque é um ponto de entrada próprio (`@upm/ui/editor`)
 *
 * **Não entra no barril de `@upm/ui`.** O site público (`apps/web`) importa o
 * design system e nunca vai ter um editor; se este módulo estivesse no
 * `index.ts`, bastaria uma falha de *tree shaking* para o TipTap aterrar no
 * bundle da home. Um ponto de entrada separado torna isso impossível em vez de
 * improvável — é a mesma figura de `@upm/ui/fonts`.
 *
 * ## O que entra e o que sai: HTML
 *
 * `value` é HTML e `onChange` devolve HTML. Os contratos guardam JSON do TipTap
 * e ficam de fora **por agora** — o que os distingue (paginação, modo foco,
 * exportação para PDF, versões) vive em volta do editor e não dentro dele, e há
 * contratos assinados no formato guardado. A convergência das duas barras de
 * ferramentas deles está registada como dívida, com prazo.
 *
 * ## O conteúdo entra uma vez, e é por isso que o cursor não salta
 *
 * O TipTap tem o seu próprio estado; `value` é lido na montagem e **não** a
 * cada tecla. Era precisamente este o problema que o `contentEditable` do
 * Composer resolvia com um `useEffect` sem dependências e um comentário a
 * explicá-lo. Aqui `resetKey` é a porta oficial: quando muda, o conteúdo é
 * reposto — é o que o Composer precisa para abrir uma resposta citada sem
 * perder o que já estava escrito noutra.
 */

export type RichTextFeature =
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "bullets"
  | "numbers"
  | "quote"
  | "link"
  | "align"
  | "history";

/** O conjunto do correio e das novidades: prosa com ligações e listas. */
export const RICH_TEXT_PROSE: RichTextFeature[] = [
  "bold",
  "italic",
  "underline",
  "strike",
  "bullets",
  "numbers",
  "quote",
  "link",
  "history",
];

export type RichTextLabels = {
  toolbar: string;
  bold: string;
  italic: string;
  underline: string;
  strike: string;
  bullets: string;
  numbers: string;
  quote: string;
  link: string;
  linkPrompt: string;
  alignLeft: string;
  alignCenter: string;
  alignRight: string;
  undo: string;
  redo: string;
  /** "Inserir {label}" — o título do botão de cada variável. */
  insertVariable: (label: string) => string;
};

export type RichTextProps = {
  /** Nome acessível da área de edição. Nunca opcional (04 §1.7). */
  label: string;
  value: string;
  onChange: (html: string) => void;
  labels: RichTextLabels;
  features?: RichTextFeature[];
  /**
   * As variáveis que este editor oferece, como chips. Vazio ou ausente e o nó
   * nem sequer entra nas extensões — é o que mantém o correio e as novidades,
   * que não têm variáveis, sem nada a mais.
   */
  variables?: EditorVariable[];
  /** Trocar este valor repõe o conteúdo a partir de `value`. */
  resetKey?: string | number;
  disabled?: boolean;
  /** Onde a barra fica. O Composer tem-na no fim, junto aos botões (04 §2.6). */
  toolbarPosition?: "top" | "bottom";
  className?: string;
  minHeight?: number;
};

export function RichText({
  label,
  value,
  onChange,
  labels,
  features = RICH_TEXT_PROSE,
  variables = [],
  resetKey,
  disabled = false,
  toolbarPosition = "top",
  className,
  minHeight = 200,
}: RichTextProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // O título da peça é sempre de quem a mostra (o assunto do e-mail, o
        // título da novidade). Um `h1` no corpo partia a hierarquia que os
        // leitores de ecrã seguem (04 §1.7).
        heading: { levels: [2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        // O que sai daqui vai para um e-mail ou para um modal: abre fora e sem
        // passar o referrer. É a mesma regra dos sanitizadores do servidor.
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      ...(features.includes("align")
        ? [TextAlign.configure({ types: ["heading", "paragraph"] })]
        : []),
      ...(variables.length > 0 ? [Variable] : []),
    ],
    content: value || "<p></p>",
    editable: !disabled,
    // Sem isto o React 19 avisa de hidratação: o TipTap monta no cliente.
    immediatelyRender: false,
    onUpdate: ({ editor: instance }) => onChange(instance.getHTML()),
    editorProps: {
      attributes: {
        "aria-label": label,
        role: "textbox",
        "aria-multiline": "true",
        style: `min-height:${minHeight}px`,
      },
    },
  });

  /**
   * A porta oficial para repor conteúdo de fora (ver a nota de topo).
   *
   * `value` fica **deliberadamente fora** das dependências: é `resetKey` que
   * manda, e segui-lo a cada tecla era voltar ao cursor a saltar. Guarda-se
   * numa `ref` para a regra das dependências não ter nada a dizer — em
   * `packages/ui` o plugin `react-hooks` não corre, e um `eslint-disable` de
   * uma regra que não existe é um erro de lint nesta pasta.
   */
  const latest = useRef(value);
  latest.current = value;

  useEffect(() => {
    if (!editor || resetKey === undefined) return;
    // O `false` é o `emitUpdate` do TipTap 2 — sem ele, repor o conteúdo
    // disparava `onChange` e marcava o rascunho como sujo na abertura.
    editor.commands.setContent(latest.current || "<p></p>", false);
  }, [editor, resetKey]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  if (!editor) return null;

  const toolbar = (
    <div
      role="toolbar"
      aria-label={labels.toolbar}
      style={{ display: "flex", flexWrap: "wrap", gap: "2px", alignItems: "center" }}
    >
      {features.includes("bold") ? (
        <Tool
          editor={editor}
          label={labels.bold}
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={14} />
        </Tool>
      ) : null}
      {features.includes("italic") ? (
        <Tool
          editor={editor}
          label={labels.italic}
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic size={14} />
        </Tool>
      ) : null}
      {features.includes("underline") ? (
        <Tool
          editor={editor}
          label={labels.underline}
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon size={14} />
        </Tool>
      ) : null}
      {features.includes("strike") ? (
        <Tool
          editor={editor}
          label={labels.strike}
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough size={14} />
        </Tool>
      ) : null}

      {features.includes("bullets") || features.includes("numbers") ? <Divider /> : null}

      {features.includes("bullets") ? (
        <Tool
          editor={editor}
          label={labels.bullets}
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List size={14} />
        </Tool>
      ) : null}
      {features.includes("numbers") ? (
        <Tool
          editor={editor}
          label={labels.numbers}
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={14} />
        </Tool>
      ) : null}
      {features.includes("quote") ? (
        <Tool
          editor={editor}
          label={labels.quote}
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote size={14} />
        </Tool>
      ) : null}
      {features.includes("link") ? (
        <Tool
          editor={editor}
          label={labels.link}
          active={editor.isActive("link")}
          onClick={() => {
            // `window.prompt` e não um modal: é o que o Composer já fazia, e um
            // diálogo próprio para colar um URL dentro de uma janela flutuante
            // é uma sobreposição dentro de outra.
            const href = window.prompt(labels.linkPrompt, editor.getAttributes("link").href ?? "");
            if (href === null) return;
            if (href === "") {
              editor.chain().focus().unsetLink().run();
              return;
            }
            editor.chain().focus().setLink({ href }).run();
          }}
        >
          <Link2 size={14} />
        </Tool>
      ) : null}

      {features.includes("align") ? (
        <>
          <Divider />
          <Tool
            editor={editor}
            label={labels.alignLeft}
            active={editor.isActive({ textAlign: "left" })}
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
          >
            <AlignLeft size={14} />
          </Tool>
          <Tool
            editor={editor}
            label={labels.alignCenter}
            active={editor.isActive({ textAlign: "center" })}
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
          >
            <AlignCenter size={14} />
          </Tool>
          <Tool
            editor={editor}
            label={labels.alignRight}
            active={editor.isActive({ textAlign: "right" })}
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
          >
            <AlignRight size={14} />
          </Tool>
        </>
      ) : null}

      {features.includes("history") ? (
        <>
          <Divider />
          <Tool
            editor={editor}
            label={labels.undo}
            onClick={() => editor.chain().focus().undo().run()}
          >
            <Undo2 size={14} />
          </Tool>
          <Tool
            editor={editor}
            label={labels.redo}
            onClick={() => editor.chain().focus().redo().run()}
          >
            <Redo2 size={14} />
          </Tool>
        </>
      ) : null}

      {/* As variáveis, como botões e não como menu: são três (04 §2.6) e um
          menu para três opções é um clique a mais para ver o que já cabia na
          barra. Entram **onde está o cursor**, que é o que uma variável
          precisa — inserir no fim é quase nunca onde se quer. */}
      {variables.length > 0 ? (
        <>
          <Divider />
          {variables.map((variable) => (
            <Button
              key={variable.name}
              size="sm"
              variant="ghost"
              title={labels.insertVariable(variable.label)}
              aria-label={labels.insertVariable(variable.label)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .insertContent({
                    type: "variable",
                    attrs: { name: variable.name, label: variable.label },
                  })
                  .run()
              }
            >
              {variable.label}
            </Button>
          ))}
        </>
      ) : null}
    </div>
  );

  return (
    <div className={className} style={{ display: "grid", gap: "var(--sp-2)" }}>
      {toolbarPosition === "top" ? toolbar : null}
      <EditorContent editor={editor} className="upm-richtext" />
      {toolbarPosition === "bottom" ? toolbar : null}
    </div>
  );
}

/**
 * O estado activo vem do editor e não de um `useState` nosso: é o que faz o
 * negrito acender quando o cursor entra numa palavra já em negrito, e é a
 * diferença mais visível em relação ao `execCommand`, que não sabia dizê-lo.
 */
function Tool({
  label,
  active = false,
  onClick,
  children,
}: {
  editor: Editor;
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      size="sm"
      variant="ghost"
      iconOnly
      aria-label={label}
      title={label}
      aria-pressed={active}
      // `onMouseDown` com `preventDefault`: um clique na barra tirava o foco do
      // editor e com ele a seleção, e o comando aplicava-se a nada.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function Divider() {
  return (
    <span
      aria-hidden="true"
      style={{ width: "1px", height: "18px", margin: "0 4px", background: "var(--border)" }}
    />
  );
}
