"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Copy, Link2, UserPlus } from "lucide-react";
import { Button, Input, Modal, Select, useToast } from "@upm/ui";
import {
  SHARE_EXPIRY_OPTIONS,
  SHARE_PERMISSION_LABELS,
  SHARE_PERMISSIONS,
  type SharePermission,
} from "@upm/db/cloud";

import type { CloudFileRow, ShareContact } from "./cloudTypes";

export type ShareState = {
  id: string;
  sharedWith: string | null;
  isLink: boolean;
  permission: SharePermission;
  expiresAt: string | null;
};

export type ShareFileModalProps = {
  file: CloudFileRow | null;
  contacts: ShareContact[];
  shares: ShareState[];
  onClose: () => void;
  onShare: (input: {
    fileId: string;
    permission: SharePermission;
    sharedWith?: string;
    asLink?: boolean;
    expiresInHours?: number | null;
    accessCode?: string;
  }) => Promise<{ ok?: boolean; url?: string; error?: string }>;
  onRevoke: (shareId: string) => Promise<{ error?: string }>;
};

/**
 * Modal de partilha (P6-02 · 04 §5.4 · 07 §19.7 e §19.11)
 * =========================================================================
 * Dois blocos, porque são dois objetos diferentes e não duas opções do mesmo:
 * **Com acesso** (pessoas) e **Ligação**. Uma partilha é para uma pessoa OU por
 * ligação — a constraint `file_shares_person_xor_link` diz o mesmo em SQL.
 *
 * Só há duas permissões: "Pode ver" e "Pode transferir". A terceira do
 * protótipo — "Pode editar" — saiu em 07 §19.7: nunca foi uma permissão de
 * partilha, e na Cloud não existe editor de ficheiros.
 *
 * "Sem expirar" mantém-se (07 §19.11). A rede de segurança não é o prazo, é a
 * revogação — sempre possível, aqui mesmo — e o registo de acessos.
 */
export function ShareFileModal({
  file,
  contacts,
  shares,
  onClose,
  onShare,
  onRevoke,
}: ShareFileModalProps) {
  const [permission, setPermission] = useState<SharePermission>("view");
  const [person, setPerson] = useState("");
  const [expiryIndex, setExpiryIndex] = useState("1");
  const [accessCode, setAccessCode] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    if (file) {
      setPermission("view");
      setPerson("");
      setExpiryIndex("1");
      setAccessCode("");
      setLink(null);
      setCopied(false);
    }
  }, [file]);

  if (!file) return null;

  const expiry = SHARE_EXPIRY_OPTIONS[Number(expiryIndex)] ?? SHARE_EXPIRY_OPTIONS[1]!;
  const nameOf = (id: string) => contacts.find((c) => c.id === id)?.name ?? "Utilizador";

  function share(asLink: boolean) {
    if (!file) return;
    if (!asLink && !person) {
      toast("Escolha com quem quer partilhar.", "error");
      return;
    }
    if (asLink && accessCode && !/^\d{4,6}$/.test(accessCode)) {
      toast("O código de acesso tem 4 a 6 dígitos.", "error");
      return;
    }

    startTransition(async () => {
      const result = await onShare({
        fileId: file.id,
        permission,
        sharedWith: asLink ? undefined : person,
        asLink,
        expiresInHours: expiry.hours,
        accessCode: asLink && accessCode ? accessCode : undefined,
      });
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      if (result.url) {
        setLink(result.url);
        toast("Ligação criada.", "success");
      } else {
        setPerson("");
        toast("Partilhado.", "success");
      }
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Partilhar"
      subtitle={file.name}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      <div style={{ display: "grid", gap: "var(--sp-7)" }}>
        <Select
          label="Permissão"
          value={permission}
          onChange={(event) => setPermission(event.target.value as SharePermission)}
          options={SHARE_PERMISSIONS.map((value) => ({
            value,
            label: SHARE_PERMISSION_LABELS[value],
          }))}
        />

        <section style={{ display: "grid", gap: "var(--sp-4)" }}>
          <strong>Com acesso</strong>
          {contacts.length === 0 ? (
            <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.6 }}>
              Ainda não fala com ninguém na plataforma. Use a ligação abaixo para enviar este
              documento a quem quiser.
            </p>
          ) : (
            <div style={{ display: "flex", gap: "var(--sp-4)", alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <Select
                  label="Pessoa"
                  value={person}
                  onChange={(event) => setPerson(event.target.value)}
                  placeholder="Escolha um contacto"
                  options={contacts.map((contact) => ({
                    value: contact.id,
                    label: contact.name,
                  }))}
                  hint="Partilha-se com quem já fala consigo; para os restantes, use a ligação."
                />
              </div>
              <Button
                size="sm"
                leadingIcon={<UserPlus size={15} />}
                disabled={pending}
                onClick={() => share(false)}
              >
                Partilhar
              </Button>
            </div>
          )}

          {shares.filter((item) => !item.isLink).length > 0 ? (
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "grid",
                gap: "var(--sp-3)",
              }}
            >
              {shares
                .filter((item) => !item.isLink)
                .map((item) => (
                  <li
                    key={item.id}
                    style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)" }}
                  >
                    <span style={{ flex: 1 }}>
                      {item.sharedWith ? nameOf(item.sharedWith) : "Utilizador"}
                      <span style={{ color: "var(--muted)" }}>
                        {" · "}
                        {SHARE_PERMISSION_LABELS[item.permission]}
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await onRevoke(item.id);
                          toast(
                            result.error ?? "Acesso revogado.",
                            result.error ? "error" : "success",
                          );
                        })
                      }
                    >
                      Revogar
                    </Button>
                  </li>
                ))}
            </ul>
          ) : null}
        </section>

        <section style={{ display: "grid", gap: "var(--sp-4)" }}>
          <strong>Ligação</strong>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-4)" }}>
            <Select
              label="Expira"
              value={expiryIndex}
              onChange={(event) => setExpiryIndex(event.target.value)}
              options={SHARE_EXPIRY_OPTIONS.map((option, index) => ({
                value: String(index),
                label: option.label,
              }))}
            />
            <Input
              label="Código de acesso"
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Opcional"
              inputMode="numeric"
              hint="4 a 6 dígitos, pedidos ao abrir a ligação."
            />
          </div>

          {link ? (
            <div style={{ display: "flex", gap: "var(--sp-3)", alignItems: "center" }}>
              <code
                style={{
                  flex: 1,
                  padding: "var(--sp-3)",
                  borderRadius: "var(--r-sm)",
                  background: "var(--surface2)",
                  fontFamily: "var(--font-mono)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {link}
              </code>
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={copied ? <Check size={15} /> : <Copy size={15} />}
                onClick={() => {
                  void navigator.clipboard.writeText(link);
                  setCopied(true);
                  toast("Ligação copiada.", "success");
                }}
              >
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<Link2 size={15} />}
              disabled={pending}
              onClick={() => share(true)}
            >
              Criar ligação
            </Button>
          )}
        </section>
      </div>
    </Modal>
  );
}
