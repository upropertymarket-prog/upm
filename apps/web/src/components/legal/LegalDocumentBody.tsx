/**
 * Corpo de um documento legal (Fase 9, P9-02)
 * =========================================================================
 * Os Termos vivem em `legal_documents.body_md` como Markdown, porque é a forma
 * em que um advogado os vai devolver revistos — e porque o hash que prova a
 * versão é o hash desse texto, não de HTML gerado.
 *
 * Este renderizador cobre o subconjunto que o documento usa: títulos `##`,
 * citação `>`, listas numeradas e por pontos, tabelas, `**negrito**` e
 * `` `código` ``. Não é um
 * Markdown completo e não quer ser: nenhuma biblioteca de Markdown entra no
 * bundle por causa de um documento, e `dangerouslySetInnerHTML` está proibido
 * fora dos três sítios de 08 §7.2 — este não é um deles. Todo o texto passa
 * pelo escape do React.
 */

/**
 * Os dois inlines que os documentos usam: `**negrito**` e `` `código` ``.
 *
 * O código entrou a 7 out 2026, com as minutas v2: a Política de Cookies nomeia
 * cookies (`upm-locale`) e rotas (`/privacidade`) entre crases, e sem isto as
 * crases apareciam no ecrã. A alternativa — tirar as crases do texto — era pior:
 * o corpo é Markdown porque é assim que um advogado o devolve revisto.
 */
function inline(text: string, keyPrefix: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
    const key = `${keyPrefix}-${index}`;

    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }

    if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={key}
          style={{
            fontFamily: "var(--font-mono, ui-monospace, monospace)",
            fontSize: "max(0.9em, 13px)",
            background: "var(--surface-2)",
            borderRadius: "var(--radius-sm, 4px)",
            padding: "0.1em 0.35em",
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    return <span key={key}>{part}</span>;
  });
}

type Block =
  | { kind: "heading"; level: 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "quote"; paragraphs: string[] }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "table"; rows: string[][] }
  | { kind: "rule" };

function tableCells(line: string): string[] {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

/**
 * Junta as linhas de uma citação em parágrafos, como o corpo já fazia com
 * `flushParagraph`. Uma linha vazia separa parágrafos.
 *
 * Sem isto cada linha era avaliada sozinha, e um `**negrito**` partido por uma
 * quebra de linha ficava com os asteriscos à vista — precisamente o caso da
 * abertura das quatro minutas ("**tem de ser revisto e / aprovado por
 * advogado**"). O corpo não sofria do mesmo porque já juntava as linhas.
 */
function quoteParagraphs(lines: string[]): string[] {
  const paragraphs: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (line.trim() === "") {
      if (current.length > 0) {
        paragraphs.push(current.join(" "));
        current = [];
      }
      continue;
    }
    current.push(line.trim());
  }
  if (current.length > 0) paragraphs.push(current.join(" "));

  return paragraphs;
}

/** Separador de tabela do Markdown: `| --- | --- |`. */
function isTableDivider(line: string): boolean {
  return /^\|[\s:|-]+\|$/.test(line.trim());
}

function parse(markdown: string): Block[] {
  const blocks: Block[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (trimmed === "") {
      flushParagraph();
      continue;
    }

    if (trimmed === "---") {
      flushParagraph();
      blocks.push({ kind: "rule" });
      continue;
    }

    const heading = /^(#{2,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      blocks.push({
        kind: "heading",
        level: heading[1]!.length === 2 ? 2 : 3,
        text: heading[2]!,
      });
      continue;
    }

    if (trimmed.startsWith(">")) {
      flushParagraph();
      const quoted: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith(">")) {
        quoted.push(lines[i]!.trim().replace(/^>\s?/, ""));
        i++;
      }
      i--;
      blocks.push({ kind: "quote", paragraphs: quoteParagraphs(quoted) });
      continue;
    }

    if (trimmed.startsWith("|")) {
      flushParagraph();
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.trim().startsWith("|")) {
        if (!isTableDivider(lines[i]!)) rows.push(tableCells(lines[i]!.trim()));
        i++;
      }
      i--;
      blocks.push({ kind: "table", rows });
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(trimmed);
    const numbered = /^\d+\.\s+(.*)$/.exec(trimmed);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = numbered !== null;
      const items: string[] = [];
      while (i < lines.length) {
        const current = lines[i]!.trim();
        const match = ordered ? /^\d+\.\s+(.*)$/.exec(current) : /^[-*]\s+(.*)$/.exec(current);
        if (match) {
          items.push(match[1]!);
          i++;
          continue;
        }
        // Continuação indentada da mesma alínea.
        if (current !== "" && /^\s{2,}/.test(lines[i]!) && items.length > 0) {
          items[items.length - 1] = `${items[items.length - 1]} ${current}`;
          i++;
          continue;
        }
        break;
      }
      i--;
      blocks.push({ kind: "list", ordered, items });
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  return blocks;
}

export function LegalDocumentBody({ markdown }: { markdown: string }) {
  const blocks = parse(markdown);

  return (
    <div style={{ display: "grid", gap: "var(--sp-4)", lineHeight: 1.65 }}>
      {blocks.map((block, index) => {
        const key = `b${index}`;

        switch (block.kind) {
          case "heading":
            return block.level === 2 ? (
              <h2
                key={key}
                style={{
                  fontSize: "1.0625rem",
                  fontWeight: "var(--fw-semibold)",
                  marginTop: "var(--sp-4)",
                }}
              >
                {inline(block.text, key)}
              </h2>
            ) : (
              <h3 key={key} style={{ fontSize: "0.9375rem", fontWeight: "var(--fw-semibold)" }}>
                {inline(block.text, key)}
              </h3>
            );

          case "quote":
            return (
              <blockquote
                key={key}
                style={{
                  margin: 0,
                  padding: "var(--sp-7)",
                  borderInlineStart: "3px solid var(--state-warn)",
                  background: "var(--warn-soft, var(--surface-2))",
                  borderRadius: "var(--radius-md, 8px)",
                  display: "grid",
                  gap: "var(--sp-2)",
                }}
              >
                {block.paragraphs.map((paragraph, pIndex) => (
                  <p key={`${key}-${pIndex}`} style={{ margin: 0 }}>
                    {inline(paragraph, `${key}-${pIndex}`)}
                  </p>
                ))}
              </blockquote>
            );

          case "list": {
            const items = block.items.map((item, itemIndex) => (
              <li key={`${key}-${itemIndex}`} style={{ marginBottom: "var(--sp-2)" }}>
                {inline(item, `${key}-${itemIndex}`)}
              </li>
            ));
            // `listStyle` explícito: o preflight do Tailwind põe `list-style:
            // none` em `ol`/`ul`, e sem isto as alíneas ficavam sem número —
            // num documento legal que remete para "§9 ponto 2", perder os
            // números é perder a remissão. Apanhado no canvas a 7 out 2026.
            return block.ordered ? (
              <ol
                key={key}
                style={{
                  margin: 0,
                  paddingInlineStart: "var(--sp-6)",
                  listStyle: "decimal outside",
                }}
              >
                {items}
              </ol>
            ) : (
              <ul
                key={key}
                style={{ margin: 0, paddingInlineStart: "var(--sp-6)", listStyle: "disc outside" }}
              >
                {items}
              </ul>
            );
          }

          case "table":
            return (
              // `overflowX` aqui e não no corpo da página: uma tabela larga rola
              // dentro de si, sem dar rolo horizontal ao documento inteiro
              // (é o que `scripts/audit-responsive.mjs` mede).
              <div key={key} style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.875rem" }}>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={`${key}-${rowIndex}`}>
                        {row.map((cell, cellIndex) => {
                          const Cell = rowIndex === 0 ? "th" : "td";
                          return (
                            <Cell
                              key={`${key}-${rowIndex}-${cellIndex}`}
                              style={{
                                border: "1px solid var(--border)",
                                padding: "var(--sp-2) var(--sp-3)",
                                textAlign: "start",
                                fontWeight: rowIndex === 0 ? 600 : 400,
                              }}
                            >
                              {inline(cell, `${key}-${rowIndex}-${cellIndex}`)}
                            </Cell>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case "rule":
            return (
              <hr
                key={key}
                style={{ border: 0, borderTop: "1px solid var(--border)", width: "100%" }}
              />
            );

          default:
            return (
              <p key={key} style={{ margin: 0 }}>
                {inline(block.text, key)}
              </p>
            );
        }
      })}
    </div>
  );
}
