"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Button, Card, CardBody, useToast } from "@upm/ui";
import type { PropertyFilters } from "@upm/db/properties";

import { PropertyFilters as PropertyFiltersForm } from "./PropertyFilters";

export type SearchAlertItem = {
  id: string;
  filters: PropertyFilters;
};

export type AlertsManagerProps = {
  alerts: SearchAlertItem[];
  createAlert: (filters: PropertyFilters) => Promise<{ ok?: boolean; error?: string }>;
  updateAlert: (id: string, filters: PropertyFilters) => Promise<{ ok?: boolean; error?: string }>;
  deleteAlert: (id: string) => Promise<{ ok?: boolean; error?: string }>;
};

/**
 * O resumo de um alerta em uma linha. Recebe os tradutores em vez de ler uma
 * constante de módulo: as etiquetas de negócio vivem em `property.deal`, e uma
 * constante aqui ficaria presa ao idioma em que foi escrita.
 */
function describeFilters(
  filters: PropertyFilters,
  t: (key: string, values?: Record<string, string | number>) => string,
  tf: (key: string) => string,
): string {
  const parts: string[] = [];
  if (filters.deal) parts.push(tf(`deal.${filters.deal}`));
  if (filters.property_type) parts.push(filters.property_type);
  if (filters.typology) parts.push(filters.typology);
  if (filters.city) parts.push(filters.city);
  if (filters.price_min_cents) parts.push(t("priceFrom", { value: filters.price_min_cents / 100 }));
  if (filters.price_max_cents) parts.push(t("priceTo", { value: filters.price_max_cents / 100 }));
  return parts.length > 0 ? parts.join(" · ") : t("noFilters");
}

function toFormValue(filters: PropertyFilters) {
  return {
    deal: filters.deal,
    property_type: filters.property_type,
    typology: filters.typology,
    price_min_cents:
      filters.price_min_cents !== undefined ? String(filters.price_min_cents) : undefined,
    price_max_cents:
      filters.price_max_cents !== undefined ? String(filters.price_max_cents) : undefined,
    city: filters.city,
  };
}

function fromFormValue(value: {
  deal?: string;
  property_type?: string;
  typology?: string;
  price_min_cents?: string;
  price_max_cents?: string;
  city?: string;
}): PropertyFilters {
  return {
    deal: value.deal as PropertyFilters["deal"],
    property_type: value.property_type as PropertyFilters["property_type"],
    typology: value.typology as PropertyFilters["typology"],
    price_min_cents: value.price_min_cents ? Number.parseInt(value.price_min_cents, 10) : undefined,
    price_max_cents: value.price_max_cents ? Number.parseInt(value.price_max_cents, 10) : undefined,
    city: value.city,
  };
}

/** CRUD de alertas de pesquisa (P4-04b) — cria, edita e apaga em cima do mesmo `PropertyFilters`. */
export function AlertsManager({
  alerts,
  createAlert,
  updateAlert,
  deleteAlert,
}: AlertsManagerProps) {
  const [items, setItems] = useState(alerts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();
  const t = useTranslations("market.alerts");
  const tf = useTranslations("property");

  const handleCreate = (value: Parameters<typeof fromFormValue>[0]) => {
    const filters = fromFormValue(value);
    startTransition(async () => {
      const result = await createAlert(filters);
      if (result.error) {
        toast.toast(result.error, "error");
        return;
      }
      toast.toast(t("created"), "success");
      setItems((current) => [...current, { id: crypto.randomUUID(), filters }]);
      setCreating(false);
    });
  };

  const handleUpdate = (id: string, value: Parameters<typeof fromFormValue>[0]) => {
    const filters = fromFormValue(value);
    startTransition(async () => {
      const result = await updateAlert(id, filters);
      if (result.error) {
        toast.toast(result.error, "error");
        return;
      }
      toast.toast(t("updated"), "success");
      setItems((current) => current.map((item) => (item.id === id ? { ...item, filters } : item)));
      setEditingId(null);
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteAlert(id);
      if (result.error) {
        toast.toast(result.error, "error");
        return;
      }
      setItems((current) => current.filter((item) => item.id !== id));
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {items.length === 0 ? (
        <p>{t("empty")}</p>
      ) : (
        items.map((item) => (
          <Card key={item.id}>
            <CardBody>
              {editingId === item.id ? (
                <PropertyFiltersForm
                  initial={toFormValue(item.filters)}
                  onApply={(value) => handleUpdate(item.id, value)}
                />
              ) : (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <span>{describeFilters(item.filters, t, tf)}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditingId(item.id)}
                      disabled={isPending}
                    >
                      {t("edit")}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      leadingIcon={<Trash2 size={14} />}
                      onClick={() => handleDelete(item.id)}
                      disabled={isPending}
                    >
                      {t("delete")}
                    </Button>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        ))
      )}

      <Card>
        <CardBody>
          {creating ? (
            <PropertyFiltersForm onApply={handleCreate} />
          ) : (
            <Button onClick={() => setCreating(true)} disabled={isPending}>
              {t("create")}
            </Button>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
