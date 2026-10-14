import { describe, expect, it } from "vitest";

import {
  MAIL_ATTACHMENT_MIMES,
  mailAttachmentPath,
  readMailAttachments,
  resolveAttachmentMime,
  safeFilename,
  sniffAttachmentFamily,
} from "./mail-attachments";

/**
 * O que se testa aqui é o que decide o que entra no bucket (D66). Um erro
 * nestas três funções não dá erro nenhum: dá um executável guardado com nome de
 * folha de cálculo, ou um anexo que o cliente enviou e que desaparece do ecrã.
 */

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
const OLE = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
/** Um executável de Windows: `MZ`. É o que esta validação existe para recusar. */
const EXE = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);

describe("sniffAttachmentFamily", () => {
  it("reconhece as famílias que têm assinatura", () => {
    expect(sniffAttachmentFamily(PDF)).toBe("pdf");
    expect(sniffAttachmentFamily(PNG)).toBe("png");
    expect(sniffAttachmentFamily(ZIP)).toBe("zip");
    expect(sniffAttachmentFamily(OLE)).toBe("ole");
    expect(sniffAttachmentFamily(WEBP)).toBe("webp");
  });

  it("não reconhece o que não está na tabela", () => {
    expect(sniffAttachmentFamily(EXE)).toBeNull();
  });
});

describe("resolveAttachmentMime", () => {
  it("aceita o que a lista aceita, com os bytes a confirmarem", () => {
    expect(resolveAttachmentMime("application/pdf", PDF)).toBe("application/pdf");
    expect(resolveAttachmentMime("image/png", PNG)).toBe("image/png");
    expect(
      resolveAttachmentMime(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ZIP,
      ),
    ).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  });

  it("recusa um executável que se declara PDF — o cabeçalho é de quem envia", () => {
    expect(resolveAttachmentMime("application/pdf", EXE)).toBeNull();
  });

  it("recusa um tipo fora da lista, mesmo com assinatura válida", () => {
    expect(resolveAttachmentMime("application/x-msdownload", PDF)).toBeNull();
    expect(resolveAttachmentMime("video/mp4", PDF)).toBeNull();
  });

  it("ignora o charset e as maiúsculas do cabeçalho", () => {
    const bytes = new TextEncoder().encode("nome;valor\nana;1\n");
    expect(resolveAttachmentMime("Text/CSV; charset=utf-8", bytes)).toBe("text/csv");
  });

  it("deixa passar texto sem assinatura, porque texto não tem nenhuma", () => {
    expect(resolveAttachmentMime("text/plain", EXE)).toBe("text/plain");
  });

  it("recusa um anexo sem tipo declarado", () => {
    expect(resolveAttachmentMime(undefined, PDF)).toBeNull();
    expect(resolveAttachmentMime("", PDF)).toBeNull();
  });

  it("a lista do código é a mesma que o bucket declara", () => {
    // Se alguém acrescentar um tipo aqui sem o acrescentar à migração, o anexo
    // passa a validação e o Storage recusa-o — e o leitor mostra `error` sem
    // ninguém saber porquê. Doze é o número que `20261014100000` declara.
    expect(MAIL_ATTACHMENT_MIMES).toHaveLength(12);
  });
});

describe("readMailAttachments", () => {
  it("lê a lista nova, com caminho", () => {
    const [file] = readMailAttachments([
      { filename: "contrato.pdf", contentType: "application/pdf", size: 2048, path: "a/b/0-c.pdf" },
    ]);
    expect(file).toMatchObject({ path: "a/b/0-c.pdf", skipped: null, cloudFileId: null });
  });

  it("trata uma mensagem de antes de D66 como anexo sem bytes", () => {
    const [file] = readMailAttachments([
      { filename: "antigo.pdf", contentType: "application/pdf", size: 10 },
    ]);
    expect(file?.path).toBeNull();
    expect(file?.skipped).toBe("error");
  });

  it("guarda a razão de quem foi recusado", () => {
    const [file] = readMailAttachments([
      { filename: "enorme.zip", contentType: "application/zip", size: 99, skipped: "size" },
    ]);
    expect(file?.skipped).toBe("size");
  });

  it("lê o ficheiro da Cloud quando alguém já o guardou", () => {
    const [file] = readMailAttachments([
      {
        filename: "a.pdf",
        contentType: "application/pdf",
        size: 1,
        path: "p",
        cloud_file_id: "f1",
      },
    ]);
    expect(file?.cloudFileId).toBe("f1");
  });

  it("sobrevive a lixo na coluna sem rebentar o ecrã", () => {
    expect(readMailAttachments(null)).toEqual([]);
    expect(readMailAttachments("[]")).toEqual([]);
    expect(readMailAttachments([null, 3, "x"])).toEqual([]);
    const [file] = readMailAttachments([{}]);
    expect(file).toMatchObject({ filename: "anexo", size: 0, path: null });
  });
});

describe("mailAttachmentPath", () => {
  it("leva a caixa à frente, que é o que a policy lê", () => {
    expect(mailAttachmentPath("caixa", "msg", 0, "Contrato final.pdf")).toBe(
      "caixa/msg/0-Contrato-final.pdf",
    );
  });

  it("distingue dois anexos com o mesmo nome na mesma mensagem", () => {
    const first = mailAttachmentPath("c", "m", 0, "scan.pdf");
    const second = mailAttachmentPath("c", "m", 1, "scan.pdf");
    expect(first).not.toBe(second);
  });
});

describe("safeFilename", () => {
  it("tira acentos, barras e tudo o que não é do alfabeto", () => {
    expect(safeFilename("Caderneta Predial — nº 3/2026.pdf")).toBe(
      "Caderneta-Predial-n-3-2026.pdf",
    );
    expect(safeFilename("Relatório de Março.xlsx")).toBe("Relatorio-de-Marco.xlsx");
  });

  it("não deixa um caminho relativo passar — o nome é escrito por quem envia", () => {
    expect(safeFilename("../../etc/passwd")).toBe("etc-passwd");
    expect(safeFilename("...pdf")).toBe("pdf");
  });

  it("nunca devolve vazio", () => {
    expect(safeFilename("///")).toBe("anexo");
    expect(safeFilename("")).toBe("anexo");
  });
});
