import { cx } from "../lib/cx";

export type TableColumn<Row> = {
  /** Chave estável da coluna. Usada como `key` do React. */
  id: string;
  header: React.ReactNode;
  cell: (row: Row) => React.ReactNode;
  /** Numerais tabulares e, por omissão, alinhamento à direita. */
  numeric?: boolean;
  /** Força o alinhamento da coluna — cabeçalho e células — ignorando `numeric`. */
  align?: "left" | "right";
  /** Largura CSS da coluna (`160px`, `2fr` não se aplica — é `<table>`). */
  width?: string;
};

/** Classe de alinhamento da coluna; `numeric` sem `align` continua à direita. */
function alignClass<Row>(column: TableColumn<Row>) {
  if (column.align) return column.align === "left" ? "upm-table__start" : "upm-table__end";
  return column.numeric ? "upm-table__end" : undefined;
}

export type TableProps<Row> = {
  /** Descreve a tabela para leitores de ecrã (`<caption>` escondido). */
  caption: string;
  columns: TableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  onRowClick?: (row: Row) => void;
  selectedKey?: string;
  /** Mostrado no corpo da tabela quando `rows` está vazio. */
  empty?: React.ReactNode;
  /** Ajuste pontual dos cabeçalhos desta tabela, sem mexer no estilo partilhado. */
  headerStyle?: React.CSSProperties;
  className?: string;
};

/**
 * Table — 04 §5.4 · 08 §3.4
 * =========================================================================
 * Genérica sobre a linha, para as tabelas do produto (Utilizadores, Leads,
 * Envios, Faturas) não repetirem a marcação.
 *
 * Duas decisões que valem uma nota:
 *  - **rola o invólucro, não a página.** 02 §13 pede 360 px → 1920 px; uma
 *    tabela larga não pode fazer o `<body>` rolar de lado.
 *  - **não pagina.** A paginação é obrigatória (08 §3.4) mas é do servidor, com
 *    keyset; a tabela recebe a página já cortada e o `<Pagination>` vive ao
 *    lado. Uma tabela que paginasse por dentro esconderia que os dados vieram
 *    todos.
 *
 * O canvas deste componente está em tempo/designs/design-system/dados/index.canvas.tsx.
 * Se alterar este componente, mantenha o canvas e a declaração de asset coerentes.
 */
export function Table<Row>({
  caption,
  columns,
  rows,
  rowKey,
  onRowClick,
  selectedKey,
  empty,
  headerStyle,
  className,
}: TableProps<Row>) {
  return (
    <div className={cx("upm-table-wrap", className)}>
      <table className="upm-table">
        <caption className="upm-sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={cx(column.numeric && "upm-table__num", alignClass(column))}
                style={
                  column.width || headerStyle
                    ? { ...headerStyle, ...(column.width ? { width: column.width } : null) }
                    : undefined
                }
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && empty ? (
            <tr className="upm-table__empty">
              <td colSpan={columns.length}>{empty}</td>
            </tr>
          ) : (
            rows.map((row) => {
              const key = rowKey(row);
              return (
                <tr
                  key={key}
                  data-selected={selectedKey === key ? "true" : undefined}
                  // O CSS põe o cursor de mão só nestas: ver `components.css`.
                  data-clickable={onRowClick ? "true" : undefined}
                  // Uma linha clicável tem de responder ao teclado (04 §5.7).
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                >
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={cx(column.numeric && "upm-table__num", alignClass(column))}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
