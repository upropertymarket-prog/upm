import { NextIntlClientProvider } from "next-intl";
import { Bath, BedDouble, Bookmark, Building2, CalendarDays, MessageCircle, Ruler, Zap } from "lucide-react";
import { Card, CardBody } from "../../../../packages/ui/src/components/Card";
import { Button } from "../../../../packages/ui/src/components/Button";
import { StatusTag as DealTagBase } from "../../../../packages/ui/src/components/StatusTag";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";

import { AppChrome } from "../../../../apps/app/src/components/AppChrome";
import { PropertyLocationMap } from "../../../../apps/app/src/components/map/PropertyLocationMap";
import ptMessages from "../../../../packages/config/messages/pt.json";
import { demoLocaleChange } from "./demo";

function DealTag(props: React.ComponentProps<typeof DealTagBase>) {
  return <div style={{ alignSelf: "flex-start" }}><DealTagBase {...props} style={{ ...props.style, position: "static", overflowX: "visible", overflowY: "visible" }} /></div>;
}

const property = {
  ref: "UPM-1041",
  title: "Apartamento T3 com varanda em Campo de Ourique",
  location: "T3 · Lisboa · Campo de Ourique",
  price: "450 000 €",
  description: "Apartamento remodelado em 2019, orientação nascente-poente e varanda de 12 m² sobre o jardim interior do quarteirão. Cozinha equipada, ar condicionado e lugar de garagem incluído.",
};

const factIcons = [BedDouble, Ruler, Bath, Building2, CalendarDays, Zap];

const facts = [
  ["Tipologia", "T3"], ["Área bruta", "118 m²"], ["Casas de banho", "2"],
  ["Piso", "3.º andar"], ["Ano de construção", "2019"], ["Certificado energético", "B"],
];

/** Página final `/market/[id]`: o mapa pertence ao detalhe do imóvel. */
export default function DetalhePropriedade() {
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ThemeProvider initialChoice="light">
        <AppChrome role="owner" userName="Ana Silva" userMeta="Proprietária · Premium" activeId="market" locale="pt" onLocaleChange={demoLocaleChange}>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <Button variant="secondary" size="sm" style={{ alignSelf: "flex-start" }}>← Voltar ao Market</Button>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 360px)", gap: 28, alignItems: "start" }}>
              <main style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 3fr) minmax(110px, 1fr)", gap: 8, height: "372px" }}>
                  <div style={{ borderRadius: 16, background: "var(--surface-muted, #eee)" }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}><div style={{ flex: 1, borderRadius: 10, background: "var(--surface-muted, #eee)" }} /><div style={{ flex: 1, borderRadius: 10, background: "var(--surface-muted, #eee)" }} /><div style={{ flex: 1, borderRadius: 10, background: "var(--surface-muted, #eee)" }} /></div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}><span style={{ color: "var(--muted)", fontSize: 12 }}>Ref. {property.ref}</span><h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.15 }}>{property.title}</h1><p style={{ margin: 0, color: "var(--muted)" }}>⌖ {property.location}</p></div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>{facts.map(([label, value], index) => { const Icon = factIcons[index]; const iconStyle = index === 0 || index === 3 ? { fill: "none", stroke: "rgb(100, 116, 139)" } : { stroke: "rgb(100, 116, 139)" }; return <div key={label} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14, background: "var(--surface)", display: "flex", alignItems: "flex-start", gap: 11, columnGap: "10px" }}><Icon size={17} color="var(--accent)" strokeWidth={2} style={iconStyle} /><div style={{ minWidth: 0 }}><span style={{ display: "block", color: "var(--muted)", fontSize: 12 }}>{label}</span><strong>{value}</strong></div></div>; })}</div>
                <div><h2 style={{ margin: "0 0 8px", fontSize: 17 }}>Descrição do proprietário</h2><p style={{ margin: 0, lineHeight: 1.75, color: "var(--muted)" }}>{property.description}</p></div>
                <Card style={{ height: "340px" }}><CardBody style={{ display: "flex", flexDirection: "column", gap: 12, height: "340px" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><strong>Localização aproximada</strong><span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 12 }}>morada exata somente após contacto</span></div><PropertyLocationMap lon={-9.1642} lat={38.7169} isExact={false} radiusM={400} style={{ height: "300px" }} /></CardBody></Card>
              </main>
              <aside style={{ position: "sticky", top: 88 }}><Card><CardBody style={{ display: "flex", flexDirection: "column", gap: 18 }}><DealTag tone="dealSale">Venda</DealTag><strong style={{ fontSize: 30 }}>{property.price}</strong><div style={{ borderTop: "1px solid var(--border)", paddingTop: "16px", paddingLeft: "16px", paddingRight: "16px" }}><strong>Proprietário</strong><div style={{ color: "var(--muted)", fontSize: 12 }}>Responde em ~2 h</div></div><div style={{ paddingLeft: "0px", paddingRight: "0px", width: "318px", display: "flex", flexDirection: "column", gap: "12px" }}><Button leadingIcon={<Bookmark size={16} aria-hidden="true" />} fullWidth>Guardar</Button><Button leadingIcon={<MessageCircle size={16} aria-hidden="true" />} variant="secondary" fullWidth>Contactar por chat</Button><Button leadingIcon={<CalendarDays size={16} aria-hidden="true" />} variant="secondary" fullWidth>Marcar visita</Button></div></CardBody></Card></aside>
            </div>
          </div>
        </AppChrome>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
