import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button, Input, Select } from "@upm/ui";
import { DEALS, PROPERTY_TYPES, TYPOLOGIES } from "@upm/db/properties";

/**
 * Filtros do Market público (P2-05 · 04 §2.1)
 * =========================================================================
 * **Um `<form method="get">` e não estado em React.** A pesquisa fica no URL,
 * e isso é o que faz as três coisas que esta página precisa: ser partilhável,
 * ser indexável, e funcionar com o JavaScript desligado. É também o que
 * permite servir o resultado de cache — um filtro em estado de cliente
 * obrigaria a render dinâmico em cada visita, e 04 §2.1 AC pede Lighthouse
 * ≥ 90.
 *
 * Não é um componente de cliente: não tem `useState` nem handlers. O botão
 * submete o formulário, que é o comportamento nativo.
 *
 * Os nomes dos campos são em português, como os do Market da app
 * (`negocio`, `tipologia`, …), para o URL ser legível a quem o partilha.
 *
 * As listas de tipo, tipologia e negócio vêm de `@upm/db/properties`, que é
 * onde a decisão de 07 §17.2 vive e é a mesma lista que o formulário do
 * proprietário usa. Escrevê-las outra vez aqui dava um filtro que não encontra
 * um tipo novo — e ninguém descobriria até alguém publicar um.
 */

export type ListingFiltersValue = {
  negocio?: string;
  tipo?: string;
  tipologia?: string;
  cidade?: string;
  preco_min?: string;
  preco_max?: string;
};

export function ListingFilters({ value }: { value: ListingFiltersValue }) {
  const t = useTranslations("publicListing.filters");
  const tf = useTranslations("property");
  const tm = useTranslations("market.filters");

  return (
    <form
      method="get"
      action="/propriedades"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(11rem, 100%), 1fr))",
        gap: "var(--sp-4)",
        // Ajustado no canvas a 12 out 2026: a grelha quebra para duas e três
        // linhas conforme a largura, e o espaçamento entre colunas deixava as
        // linhas demasiado juntas quando isso acontecia. A coluna fica no
        // `gap` acima; só a linha sobe.
        rowGap: "16px",
        alignItems: "end",
        padding: "var(--sp-7)",
        borderRadius: "var(--r-lg)",
        border: "1px solid var(--border)",
        background: "var(--surface)",
      }}
    >
      <Input label={t("locality")} name="cidade" defaultValue={value.cidade ?? ""} />

      <Select
        label={tf("fields.deal")}
        name="negocio"
        defaultValue={value.negocio ?? ""}
        options={[
          { value: "", label: tm("any") },
          ...DEALS.map((deal) => ({ value: deal, label: tf(`deal.${deal}`) })),
        ]}
      />

      <Select
        label="Tipo"
        name="tipo"
        defaultValue={value.tipo ?? ""}
        options={[
          { value: "", label: tm("any") },
          ...PROPERTY_TYPES.map((type) => ({ value: type, label: type })),
        ]}
      />

      <Select
        label="Tipologia"
        name="tipologia"
        defaultValue={value.tipologia ?? ""}
        options={[
          { value: "", label: tm("anyTypology") },
          ...TYPOLOGIES.map((typology) => ({ value: typology, label: typology })),
        ]}
      />

      {/* Em euros para quem escreve, em cêntimos na base de dados — a conversão
          é do lado do servidor. Pedir cêntimos a um visitante seria absurdo. */}
      <Input
        label={t("priceMin")}
        name="preco_min"
        type="number"
        min={0}
        step={1000}
        defaultValue={value.preco_min ?? ""}
      />
      <Input
        label={t("priceMax")}
        name="preco_max"
        type="number"
        min={0}
        step={1000}
        defaultValue={value.preco_max ?? ""}
      />

      {/* `1 / -1`: a linha das ações atravessa a grelha inteira. Sem isto
          caía numa célula de ~11rem e os dois botões empilhavam um debaixo do
          outro, com o resto da linha vazio — visto na captura da storyboard
          `ImoveisClaro`. */}
      <div
        style={{
          gridColumn: "1 / -1",
          display: "flex",
          gap: "var(--sp-3)",
          flexWrap: "wrap",
        }}
      >
        <Button type="submit">{t("search")}</Button>
        {/* Uma navegação e não um botão de `reset`: `reset` devolveria os campos
            aos valores que vieram do URL, que é o oposto de limpar a pesquisa. */}
        <Link href="/propriedades" className="upm-btn upm-btn--secondary upm-btn--md">
          {t("clear")}
        </Link>
      </div>
    </form>
  );
}
