"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Heart, Image as ImageIcon, MapPin, Ruler } from "lucide-react";
import { Button, Card, Input, Pagination, Select, StatusTag } from "@upm/ui";
import { DEMO_LISTINGS, type DemoListing } from "@upm/ui/demo-data";

import { useDemoFormat } from "./format";

/**
 * Market e Guardados da demonstração — 04 §2.5 e §8.4
 * =========================================================================
 * O Market do produto é filtros + grelha de cartões + paginação; Guardados é a
 * mesma grelha, com os imóveis que a pessoa guardou e a variação de preço
 * desde então. É o que estes dois ecrãs mostram, com os componentes reais.
 *
 * **O filtro de negócio funciona.** Não por capricho: a demonstração existe
 * para se perceber que o Market filtra, e um `<select>` que não faz nada
 * ensina o contrário. Os restantes controlos desenham-se — a paginação de uma
 * página, o coração de guardar — porque mexer neles exigiria dados que uma
 * fixture não tem.
 *
 * Sem fotografias: o projeto não tem nenhuma, e um `<img>` para um ficheiro
 * inexistente é pior do que a moldura vazia. Daí o ícone em `--surface2`, que
 * é também o que o cartão do site público faz quando um anúncio não tem capa.
 */

function ListingCard({
  listing,
  showChange = false,
}: {
  listing: DemoListing;
  showChange?: boolean;
}) {
  const t = useTranslations("market");
  const tDeal = useTranslations("property.deal");
  const tSaved = useTranslations("saved");
  const tPlan = useTranslations("plan");
  const tDemo = useTranslations("site.demo");
  const format = useDemoFormat();

  return (
    <Card style={{ display: "grid", gridTemplateRows: "auto 1fr", height: "100%", minWidth: 0 }}>
      <div style={{ position: "relative" }}>
        <div
          aria-hidden="true"
          style={{
            aspectRatio: "16 / 10",
            background: "var(--surface2)",
            borderRadius: "var(--r-lg) var(--r-lg) 0 0",
            display: "grid",
            placeItems: "center",
            color: "var(--border2)",
          }}
        >
          <ImageIcon size={28} />
        </div>
        <span style={{ position: "absolute", top: "var(--sp-4)", left: "var(--sp-4)" }}>
          <StatusTag tone={listing.deal === "sale" ? "dealSale" : "dealRent"}>
            {tDeal(listing.deal)}
          </StatusTag>
        </span>
        <button
          type="button"
          aria-label={tDemo("toggleSaved")}
          aria-pressed={listing.saved}
          className="upm-btn upm-btn--secondary upm-btn--icon"
          style={{ position: "absolute", top: "var(--sp-4)", right: "var(--sp-4)" }}
        >
          <Heart
            size={15}
            aria-hidden="true"
            fill={listing.saved ? "var(--accent)" : "none"}
            color={listing.saved ? "var(--accent)" : "currentColor"}
          />
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gap: "var(--sp-3)",
          alignContent: "start",
          padding: "var(--sp-5)",
          minWidth: 0,
        }}
      >
        <strong style={{ fontSize: "var(--fs-body-lg)", lineHeight: 1.3 }}>{listing.title}</strong>

        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-subtitle-lg)",
            lineHeight: 1.1,
          }}
        >
          {format.euro(listing.cents)}
          {listing.deal === "rent" ? (
            <span
              style={{
                fontSize: "var(--fs-label)",
                color: "var(--muted)",
                fontWeight: "var(--fw-regular)",
              }}
            >
              {tPlan("perMonth")}
            </span>
          ) : null}
        </span>

        {showChange && listing.previousCents ? (
          <span style={{ fontSize: "var(--fs-label)", color: "var(--ok)" }}>
            {tSaved("dropped")} · {tSaved("priceAtSave")} {format.euro(listing.previousCents)}
          </span>
        ) : null}

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--sp-2) var(--sp-5)",
            fontSize: "var(--fs-label)",
            color: "var(--muted)",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-2)" }}>
            {listing.typology}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-2)" }}>
            <Ruler size={14} aria-hidden="true" />
            {t("area", { value: listing.area })}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-2)" }}>
            <MapPin size={14} aria-hidden="true" />
            {listing.city}
          </span>
        </div>
      </div>
    </Card>
  );
}

function Grid({ listings, showChange }: { listings: DemoListing[]; showChange?: boolean }) {
  return (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
        gap: "var(--sp-6)",
        alignItems: "stretch",
      }}
    >
      {listings.map((listing) => (
        <li key={listing.id} style={{ display: "grid", minWidth: 0 }}>
          <ListingCard listing={listing} showChange={showChange} />
        </li>
      ))}
    </ul>
  );
}

export function DemoMarket() {
  const t = useTranslations("market");
  const tDeal = useTranslations("property.deal");
  const tField = useTranslations("property.fields");
  const tPagination = useTranslations("pagination");
  const [deal, setDeal] = useState("");

  const visible = deal ? DEMO_LISTINGS.filter((listing) => listing.deal === deal) : DEMO_LISTINGS;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
      <Card padded>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))",
            gap: "var(--sp-5)",
            alignItems: "end",
          }}
        >
          <Select
            label={tField("deal")}
            value={deal}
            onChange={(event) => setDeal(event.target.value)}
            placeholder={t("filters.any")}
            options={[
              { value: "sale", label: tDeal("sale") },
              { value: "rent", label: tDeal("rent") },
            ]}
          />
          {/* `defaultValue` e não `value`: estes dois desenham-se e não
              filtram, e um `value` sem `onChange` é um campo só de leitura —
              React avisa, com razão. O que filtra é o negócio, acima. */}
          <Select
            label={tField("typology")}
            defaultValue=""
            placeholder={t("filters.anyTypology")}
            options={[
              { value: "T1", label: "T1" },
              { value: "T2", label: "T2" },
              { value: "T3", label: "T3" },
              { value: "T4", label: "T4" },
            ]}
          />
          <Input label={t("filters.priceMin")} type="number" min={0} defaultValue="" />
          <Input label={t("filters.priceMax")} type="number" min={0} defaultValue="" />
          <Input label={tField("city")} defaultValue="" />
          <div style={{ alignSelf: "end" }}>
            <Button variant="secondary" fullWidth>
              {t("filters.submit")}
            </Button>
          </div>
        </div>
      </Card>

      <Grid listings={visible} />

      <Pagination
        page={1}
        pageCount={1}
        onPageChange={() => undefined}
        summary={tPagination("summary", { from: 1, to: visible.length, total: visible.length })}
        labels={{
          previous: tPagination("previous"),
          next: tPagination("next"),
          page: tPagination("page"),
        }}
      />
    </div>
  );
}

export function DemoSaved() {
  const saved = DEMO_LISTINGS.filter((listing) => listing.saved);
  return <Grid listings={saved} showChange />;
}
