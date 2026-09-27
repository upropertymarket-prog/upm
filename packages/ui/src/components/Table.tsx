import { cx } from "../lib/cx";

export type TableColumn<Row> = {
  /** Chave estável da coluna. Usada como `key` do React. */
  id: string;
  header: React.ReactNode;
  cell: (row: Row) => React.ReactNode;
  /** Alinha à direita e usa numerais tabulares (preços, contagens). */
  numeric?: boolean;
  /** Largura CSS da coluna (`160px`, `2fr` não se aplica — é `<table>`). */
  width?: string;
};

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
                className={cx(column.numeric && "upm-table__num")}
                style={column.width ? { width: column.width } : undefined}
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
                    <td key={column.id} className={cx(column.numeric && "upm-table__num")}>
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
