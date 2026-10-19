"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, Link2, UserPlus } from "lucide-react";
import { Button, Input, Modal, Select, useToast } from "@upm/ui";
import { SHARE_EXPIRY_OPTIONS, SHARE_PERMISSIONS, type SharePermission } from "@upm/db/cloud";

import type { ShareContact } from "../cloud/cloudTypes";
import type { ContractDetail } from "./contractTypes";

export type ContractShareState = {
  id: string;
  sharedWith: string | null;
  isLink: boolean;
  permission: SharePermission;
  expiresAt: string | null;
};

export type ShareContractModalProps = {
  open: boolean;
  contract: ContractDetail;
  contacts: ShareContact[];
  shares: ContractShareState[];
  onClose: () => void;
  onShare: (input: {
    contractId: string;
    permission: SharePermission;
    sharedWith?: string;
    asLink?: boolean;
    expiresInHours?: number | null;
    accessCode?: string;
  }) => Promise<{ ok?: boolean; url?: string; error?: string }>;
  onRevoke: (shareId: string) => Promise<{ error?: string }>;
};

/**
 * Partilhar um contrato (07 §5.5)
 * =========================================================================
 * Tabela própria, `contract_shares`, e não `file_shares`: o que se partilha é
 * outra coisa. O contrato partilhado aparece em `/contratos` da contraparte, em
 * leitura — não é um ficheiro que se arrasta para uma pasta.
 *
 * E partilhar **congela a versão** (07 §13.2): o que a contraparte vê fica
 * registado e não se reescreve por trás. Continuar a editar depois de partilhar
 * é legítimo; o que a outra pessoa abriu é que não muda sozinho.
 */
export function ShareContractModal({
  open,
  contract,
  contacts,
  shares,
  onClose,
  onShare,
  onRevoke,
}: ShareContractModalProps) {
  const t = useTranslations("contracts.shareModal");
  const tShare = useTranslations("share");
  const tCommon = useTranslations("common");
  const [permission, setPermission] = useState<SharePermission>("view");
  const [person, setPerson] = useState("");
  const [expiryIndex, setExpiryIndex] = useState("1");
  const [accessCode, setAccessCode] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setPermission("view");
      setPerson("");
      setExpiryIndex("1");
      setAccessCode("");
      setLink(null);
      setCopied(false);
    }
  }, [open]);

  if (!open) return null;

  const expiry = SHARE_EXPIRY_OPTIONS[Number(expiryIndex)] ?? SHARE_EXPIRY_OPTIONS[1]!;
  const nameOf = (id: string) => contacts.find((c) => c.id === id)?.name ?? tShare("someone");

  function submit(asLink: boolean) {
    if (!asLink && !person) {
      toast(tShare("pickPerson"), "error");
      return;
    }
    if (asLink && accessCode && !/^\d{4,6}$/.test(accessCode)) {
      toast(tShare("badCode"), "error");
      return;
    }

    startTransition(async () => {
      const result = await onShare({
        contractId: contract.id,
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
        toast(t("linkCreated"), "success");
      } else {
        setPerson("");
        toast(t("shared"), "success");
      }
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t("title")}
      subtitle={contract.title}
      footer={
        <Button variant="secondary" onClick={onClose}>
          {tCommon("close")}
        </Button>
      }
    >
      <div style={{ display: "grid", gap: "var(--sp-7)" }}>
        <Select
          label={tShare("permissionLabel")}
          value={permission}
          onChange={(event) => setPermission(event.target.value as SharePermission)}
          options={SHARE_PERMISSIONS.map((value) => ({
            value,
            label: tShare(`permission.${value}`),
          }))}
          hint={t("permissionHint")}
        />

        <section style={{ display: "grid", gap: "var(--sp-4)" }}>
          <strong>{tShare("withAccess")}</strong>
          {contacts.length === 0 ? (
            <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.6 }}>{t("noContacts")}</p>
          ) : (
            <div style={{ display: "flex", gap: "var(--sp-4)", alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <Select
                  label={tShare("person")}
                  value={person}
                  onChange={(event) => setPerson(event.target.value)}
                  placeholder={tShare("personPlaceholder")}
                  options={contacts.map((contact) => ({
                    value: contact.id,
                    label: contact.name,
                  }))}
                />
              </div>
              <Button
                size="sm"
                leadingIcon={<UserPlus size={15} />}
                disabled={pending}
                onClick={() => submit(false)}
              >
                {tShare("shareAction")}
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
                      {item.sharedWith ? nameOf(item.sharedWith) : tShare("someone")}
                      <span style={{ color: "var(--muted)" }}>
                        {" · "}
                        {tShare(`permission.${item.permission}`)}
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
                            result.error ?? tShare("revoked"),
                            result.error ? "error" : "success",
                          );
                        })
                      }
                    >
                      {tShare("revoke")}
                    </Button>
                  </li>
                ))}
            </ul>
          ) : null}
        </section>

        <section style={{ display: "grid", gap: "var(--sp-4)" }}>
          <strong>{tShare("link")}</strong>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 136px), 1fr))",
              gap: "var(--sp-4)",
            }}
          >
            <Select
              label={tShare("expires")}
              value={expiryIndex}
              onChange={(event) => setExpiryIndex(event.target.value)}
              options={SHARE_EXPIRY_OPTIONS.map((option, index) => ({
                value: String(index),
                label: tShare(`expiry.${option.key}`),
              }))}
            />
            <Input
              label={tShare("accessCode")}
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder={tShare("accessCodeOptional")}
              inputMode="numeric"
              hint={t("accessCodeHint")}
            />
          </div>

          {link ? (
            <div style={{ display: "flex", gap: "var(--sp-3)", alignItems: "center" }}>
              <code
                style={{
                  flex: 1,
                  minWidth: 0,
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
                  toast(tShare("linkCopied"), "success");
                }}
              >
                {copied ? tShare("copied") : tShare("copy")}
              </Button>
            </div>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<Link2 size={15} />}
              disabled={pending}
              onClick={() => submit(true)}
            >
              {tShare("createLink")}
            </Button>
          )}
        </section>
      </div>
    </Modal>
  );
}
