"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { Download } from "lucide-react";
import { Button, Card, StatusTag } from "@upm/ui";
import { CONTRACT_STATUS_TONES } from "@upm/db/cloud";

import type { ContractSharedWithMeRow } from "./contractTypes";
import { Variable, substituteVariables } from "./VariableNode";
import "./contract-editor.css";

export type SharedContractViewProps = {
  contract: ContractSharedWithMeRow;
};

/**
 * Um contrato que alguém partilhou connosco (07 §5.5 · §13.2)
 * =========================================================================
 * Leitura e mais nada — não há permissão de edição numa partilha de contrato.
 * O corpo que chega aqui é a **versão congelada** que a partilha fixou, não o
 * que o dono continua a escrever do outro lado.
 *
 * "Transferir PDF" é o navegador a imprimir esta folha, como no editor. Quem só
 * tem permissão de ver não vê o botão: a diferença entre `view` e `download`
 * tem de existir na interface, não só na policy.
 */
export function SharedContractView({ contract }: SharedContractViewProps) {
  const t = useTranslations("contracts.sharedView");
  const tKind = useTranslations("contracts.kind");
  const tStatus = useTranslations("contracts.status");
  const router = useRouter();
  const editor = useEditor({
    editable: false,
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table,
      TableRow,
      TableHeader,
      TableCell,
      Variable,
    ],
    content: substituteVariables(contract.body, contract.values) as never,
  });

  return (
    <div className="upm-contract" style={{ display: "grid", gap: "var(--sp-6)" }}>
      <Card
        padded
        style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)", flexWrap: "wrap" }}
      >
        <div style={{ display: "grid", flex: 1, minWidth: 0 }}>
          <strong>{contract.title}</strong>
          <span style={{ color: "var(--muted)" }}>
            {tKind(contract.kind)} · {t("sharedByLine", { name: contract.sharedByName })}
          </span>
        </div>
        <StatusTag tone={CONTRACT_STATUS_TONES[contract.status] as never}>
          {tStatus(contract.status)}
        </StatusTag>
        {contract.permission === "download" ? (
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Download size={15} />}
            onClick={() => window.print()}
          >
            {t("downloadPdf")}
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={() => router.push("/contratos")}>
          {t("back")}
        </Button>
      </Card>

      <div className="upm-contract__surface upm-contract__print" style={{ maxWidth: 720 }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
