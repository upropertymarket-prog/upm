"use client";

import { useEffect, useRef } from "react";
import { Bold, Italic, Link2, List, ListOrdered, Quote, Redo2, Undo2 } from "lucide-react";
import { Button } from "@upm/ui";

/**
 * O editor rico do corpo de uma novidade (P10-07 · 04 §2.6)
 * =========================================================================
 * 04 §2.6 pede "editor rico" para as Atualizações — ao contrário das
 * Assinaturas, onde pede "editor HTML". A diferença não é de gosto: uma
 * assinatura chega colada de um designer, com tabelas e `style` em linha que um
 * editor rico destruiria; uma novidade é **prosa que se escreve aqui**.
 *
 * ## Porque é `contentEditable` e não o TipTap
 *
 * 02 §3.2 nomeia o TipTap para "contratos, atualizações, e-mail, respostas", e
 * ele é a escolha certa nos **contratos**: lá o documento é estruturado, tem
 * variáveis como nós e serializa para PDF. Aqui o que se guarda é HTML simples
 * que vai aparecer dentro de um modal. O Composer de P10-05 tomou esta mesma
 * decisão pela mesma razão, e esta é a segunda vez — o que quer dizer que o
 * sítio certo para um editor comum é a tarefa seguinte: **P10-08** traz o
 * construtor de campanhas por blocos, que precisa de muito mais do que isto, e
 * é aí que vale a pena extrair um editor partilhado em vez de escrever um
 * terceiro. Fica dito para não ficar esquecido.
 *
 * Patch proposto a 02 §3.2 no fim da fase: o TipTap é dos contratos; o correio,
 * as novidades e as campanhas usam HTML.
 */

export function UpdateBodyEditor({
  label,
  value,
  onChange,
  toolbarLabel,
  labels,
}: {
  label: string;
  value: string;
  onChange: (html: string) => void;
  toolbarLabel: string;
  labels: {
    bold: string;
    italic: string;
    bullets: string;
    numbers: string;
    quote: string;
    link: string;
    linkPrompt: string;
    undo: string;
    redo: string;
  };
}) {
  const body = useRef<HTMLDivElement>(null);

  /**
   * O conteúdo inicial entra uma vez, por `innerHTML`. Um `contentEditable`
   * controlado por React perde a posição do cursor a cada tecla — é a mesma
   * nota que está no Composer, e a razão pela qual este `useEffect` não tem
   * `value` nas dependências.
   */
  useEffect(() => {
    if (body.current && body.current.innerHTML !== value) {
      body.current.innerHTML = value || "<p><br></p>";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * `execCommand` está marcado como obsoleto há anos e continua a ser o que
   * todos os browsers implementam para isto. A alternativa — manipular
   * `Selection` e `Range` à mão — é escrever meio editor para ter negrito.
   */
  function run(command: string, argument?: string) {
    body.current?.focus();
    document.execCommand(command, false, argument);
    onChange(body.current?.innerHTML ?? "");
  }

  return (
    <div style={{ display: "grid", gap: "var(--sp-2)" }}>
      <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text)" }}>{label}</span>

      <div
        role="toolbar"
        aria-label={toolbarLabel}
        style={{ display: "flex", flexWrap: "wrap", gap: "2px" }}
      >
        <Button
          size="sm"
          variant="ghost"
          iconOnly
          aria-label={labels.bold}
          onClick={() => run("bold")}
        >
          <Bold size={14} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          iconOnly
          aria-label={labels.italic}
          onClick={() => run("italic")}
        >
          <Italic size={14} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          iconOnly
          aria-label={labels.bullets}
          onClick={() => run("insertUnorderedList")}
        >
          <List size={14} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          iconOnly
          aria-label={labels.numbers}
          onClick={() => run("insertOrderedList")}
        >
          <ListOrdered size={14} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          iconOnly
          aria-label={labels.quote}
          onClick={() => run("formatBlock", "blockquote")}
        >
          <Quote size={14} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          iconOnly
          aria-label={labels.link}
          onClick={() => {
            const href = window.prompt(labels.linkPrompt);
            if (href) run("createLink", href);
          }}
        >
          <Link2 size={14} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          iconOnly
          aria-label={labels.undo}
          onClick={() => run("undo")}
        >
          <Undo2 size={14} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          iconOnly
          aria-label={labels.redo}
          onClick={() => run("redo")}
        >
          <Redo2 size={14} />
        </Button>
      </div>

      <div
        ref={body}
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        suppressContentEditableWarning
        onInput={() => onChange(body.current?.innerHTML ?? "")}
        style={{
          minHeight: "220px",
          padding: "var(--sp-3)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          background: "var(--surface2)",
          color: "var(--text)",
          fontSize: "14px",
          lineHeight: 1.6,
          overflowWrap: "anywhere",
        }}
      />
    </div>
  );
}
