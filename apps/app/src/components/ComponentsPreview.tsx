"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Bookmark, Download, Plus, Search } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Checkbox,
  Drawer,
  EmptyState,
  Input,
  Modal,
  Pagination,
  Select,
  StatusTag,
  Table,
  Tabs,
  Textarea,
  Toggle,
  useToast,
} from "@upm/ui";

/**
 * Amostra dos componentes base (P1-04)
 * =========================================================================
 * Serve dois propósitos e nenhum deles é decorativo:
 *  - dá um ecrã real onde ver hover, foco, desativado e modo escuro dos 14
 *    componentes, que é o critério de aceitação de P1-04;
 *  - é o que a Route Storyboard do canvas do design system aponta, agora que o
 *    Storybook saiu (07 §4.5).
 *
 * É substituído pelo `/painel` a sério na Fase 4.
 */

type Row = { ref: string; title: string; city: string; price: string; state: "active" | "pending" };

const ROWS: Row[] = [
  {
    ref: "UPM-1041",
    title: "Apartamento T3 com varanda",
    city: "Lisboa",
    price: "485 000 €",
    state: "active",
  },
  {
    ref: "UPM-1042",
    title: "Moradia T4 com jardim",
    city: "Cascais",
    price: "1 250 000 €",
    state: "active",
  },
  {
    ref: "UPM-1047",
    title: "Apartamento T4 vista rio",
    city: "Porto",
    price: "890 000 €",
    state: "pending",
  },
];

export function ComponentsPreview() {
  const t = useTranslations();
  const { toast } = useToast();

  const [tab, setTab] = useState("all");
  const [page, setPage] = useState(1);
  const [drawerRow, setDrawerRow] = useState<Row | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [approx, setApprox] = useState(true);
  const [terms, setTerms] = useState(false);

  return (
    <>
      <Tabs
        label="Estado"
        value={tab}
        onValueChange={setTab}
        items={[
          { id: "all", label: "Todos", count: 3 },
          { id: "active", label: "Ativos", count: 2, countTone: "active" },
          { id: "pending", label: "Em moderação", count: 1, countTone: "pending" },
          { id: "archived", label: "Arquivados", count: 0, countTone: "archived", disabled: true },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Componentes base</CardTitle>
          <Badge>14</Badge>
        </CardHeader>
        <CardBody>
          <div style={{ display: "flex", gap: "var(--sp-4)", flexWrap: "wrap" }}>
            <Button leadingIcon={<Plus size={15} />} onClick={() => toast("Guardado", "success")}>
              {t("common.save")}
            </Button>
            <Button variant="secondary" leadingIcon={<Download size={15} />}>
              {t("common.export")}
            </Button>
            <Button variant="ghost">{t("common.cancel")}</Button>
            <Button variant="danger">Eliminar conta</Button>
            <Button disabled>Desativado</Button>
            <Button iconOnly aria-label={t("common.search")}>
              <Search size={17} />
            </Button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "var(--sp-5)",
            }}
          >
            <Input label="Título" placeholder="Apartamento T3 com varanda" defaultValue="" />
            <Input
              label={t("common.search")}
              leadingIcon={<Search size={16} />}
              placeholder="Referência, localidade…"
            />
            <Select
              label="Negócio"
              placeholder="Todos"
              options={[
                { value: "sale", label: "Venda" },
                { value: "rent", label: "Arrendamento" },
              ]}
            />
            <Input label="Preço" error="Indique um valor acima de 0 €" defaultValue="0" />
            <Input label="Referência" disabled defaultValue="UPM-1041" />
          </div>

          <Textarea label="Descrição do proprietário" hint="Máximo 2 000 caracteres." />

          <div style={{ display: "flex", gap: "var(--sp-5)", flexWrap: "wrap" }}>
            <StatusTag tone="dealSale">Venda</StatusTag>
            <StatusTag tone="dealRent">Arrendamento</StatusTag>
            <StatusTag tone="visitPending">Pendente</StatusTag>
            <StatusTag tone="visitAccepted">Aceite</StatusTag>
            <StatusTag tone="visitCancelled">Cancelada</StatusTag>
            <StatusTag tone="visitArchived">Arquivada</StatusTag>
            <StatusTag tone="draft">Rascunho</StatusTag>
          </div>

          <Toggle
            checked={approx}
            onCheckedChange={setApprox}
            label="Mostrar só a localização aproximada"
            hint="A morada exata fica reservada a compradores autorizados (07 §1)."
          />
          <Checkbox
            checked={terms}
            onChange={(event) => setTerms(event.target.checked)}
            label="Aceito os termos e a política de privacidade"
          />

          <div style={{ display: "flex", gap: "var(--sp-4)", flexWrap: "wrap" }}>
            <Button variant="secondary" onClick={() => setModalOpen(true)}>
              Abrir modal
            </Button>
            <Button variant="secondary" onClick={() => setDrawerRow(ROWS[0] ?? null)}>
              Abrir drawer
            </Button>
            <Button variant="ghost" onClick={() => toast("Não foi possível transferir", "error")}>
              Toast de erro
            </Button>
          </div>
        </CardBody>
      </Card>

      <Table
        caption="Imóveis do portfólio"
        rows={ROWS}
        rowKey={(row) => row.ref}
        onRowClick={setDrawerRow}
        selectedKey={drawerRow?.ref}
        columns={[
          {
            id: "ref",
            header: "Ref.",
            width: "120px",
            cell: (row) => <span style={{ fontFamily: "var(--font-mono)" }}>{row.ref}</span>,
          },
          { id: "title", header: "Imóvel", cell: (row) => row.title },
          { id: "city", header: "Localidade", cell: (row) => row.city },
          { id: "price", header: "Preço", numeric: true, cell: (row) => row.price },
          {
            id: "state",
            header: "Estado",
            cell: (row) => (
              <StatusTag tone={row.state === "active" ? "active" : "pending"}>
                {row.state === "active" ? "Ativo" : "Em moderação"}
              </StatusTag>
            ),
          },
        ]}
      />

      <Pagination
        page={page}
        pageCount={12}
        onPageChange={setPage}
        summary={t("pagination.summary", { from: (page - 1) * 20 + 1, to: page * 20, total: 240 })}
        labels={{
          previous: t("pagination.previous"),
          next: t("pagination.next"),
          page: t("pagination.page"),
        }}
      />

      <EmptyState
        icon={<Bookmark size={40} />}
        title="Nenhum imóvel guardado"
        description="Guarde os imóveis de que gostar para os encontrar aqui mais tarde."
        action={<Button>Explorar propriedades</Button>}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Pedir visita"
        subtitle="O proprietário recebe uma notificação e responde na Agenda."
        closeLabel={t("common.close")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => {
                setModalOpen(false);
                toast("Pedido de visita enviado", "success");
              }}
            >
              {t("common.confirm")}
            </Button>
          </>
        }
      >
        <Input label="Data" type="date" />
        <Input label="Hora" type="time" />
        <Textarea label="Mensagem" hint="Opcional." />
      </Modal>

      <Drawer
        open={drawerRow !== null}
        onClose={() => setDrawerRow(null)}
        title={drawerRow?.title ?? ""}
        subtitle={drawerRow ? `${drawerRow.ref} · ${drawerRow.city}` : undefined}
        closeLabel={t("common.close")}
        footer={
          <Button variant="secondary" onClick={() => setDrawerRow(null)}>
            {t("common.close")}
          </Button>
        }
      >
        <Input label="Preço" defaultValue={drawerRow?.price ?? ""} />
        <Select
          label="Estado"
          defaultValue={drawerRow?.state ?? "active"}
          options={[
            { value: "active", label: "Ativo" },
            { value: "pending", label: "Em moderação" },
          ]}
        />
        <Textarea label="Notas" />
      </Drawer>
    </>
  );
}
