/**
 * Anexos do correio — a lista, os limites e a verificação (P10-06/D66)
 * =========================================================================
 * Este ficheiro existe para haver **uma** definição de "anexo aceitável". O
 * `mail-worker` decide com ela o que descarrega; a app decide com ela o que
 * mostra; o bucket `mail-attachments` repete-a como rede de segurança. Três
 * sítios a verificar a mesma coisa é o padrão de 07 §20.5 — o que não pode
 * haver são três listas diferentes, porque a que divergir vai ser a que decide.
 *
 * ## Porque é que a lista não é a de `ticket-screenshots`
 *
 * D66 pedia "a mesma validação de tipo e tamanho que `ticket-screenshots` já
 * tem". O que se herda é o **mecanismo** — lista fechada no bucket, limite de
 * tamanho, verificação nos dois lados —, não a lista: `ticket-screenshots` é
 * uma captura de ecrã e aceita três formatos de imagem. Aplicada ao correio,
 * recusaria o PDF, que é a maioria do que um cliente anexa. A lista daqui é a
 * de escritório, decidida pelo cliente a 14 out 2026.
 *
 * ## Os três limites, e o que cada um protege
 *
 * - `MAIL_ATTACHMENT_MAX_BYTES` (10 MB) protege o bucket e a memória do worker:
 *   um anexo passa pelo processo inteiro em memória antes de subir.
 * - `MAIL_ATTACHMENT_MESSAGE_MAX_BYTES` (25 MB) protege a **passagem**. Sem
 *   teto por mensagem, um e-mail com trinta PDFs de 9 MB fazia uma
 *   sincronização sozinho e deixava as outras caixas à espera.
 * - `MAIL_ATTACHMENT_MAX_FILES` (10) protege o mesmo pelo outro lado: cem
 *   anexos de 50 KB cabem no teto de bytes e são cem subidas.
 *
 * Nada disto apaga informação: o anexo recusado **fica na lista**, com nome,
 * tipo e tamanho, e com a razão por que não tem bytes. O leitor diz essa razão
 * em vez de mostrar um botão que devolve um ficheiro vazio.
 */

/** 14 out 2026 — decisão do cliente. */
export const MAIL_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const MAIL_ATTACHMENT_MESSAGE_MAX_BYTES = 25 * 1024 * 1024;
export const MAIL_ATTACHMENT_MAX_FILES = 10;

/** 180 dias, e é só o valor por omissão: manda `app_settings`. */
export const MAIL_ATTACHMENT_RETENTION_DAYS = 180;

export const MAIL_ATTACHMENT_BUCKET = "mail-attachments";

/**
 * Os tipos que o worker guarda. É a mesma lista que o bucket declara em
 * `allowed_mime_types` e a mesma que o bucket `cloud` passou a aceitar, para
 * que tudo o que se guarde possa ir para a Cloud interna sem uma segunda
 * conversa sobre tipos.
 */
export const MAIL_ATTACHMENT_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
] as const;

export type MailAttachmentMime = (typeof MAIL_ATTACHMENT_MIMES)[number];

/** Os que um browser imprime a sério. O resto só se transfere. */
export const MAIL_ATTACHMENT_PRINTABLE: readonly string[] = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

/**
 * Porque é que um anexo ficou sem bytes. Guardado na própria lista, para o
 * leitor poder dizer a razão — "não guardámos" sem razão é o mesmo que um erro.
 */
export const MAIL_ATTACHMENT_SKIPS = ["type", "size", "count", "error", "purged"] as const;
export type MailAttachmentSkip = (typeof MAIL_ATTACHMENT_SKIPS)[number];

export type MailAttachment = {
  filename: string;
  contentType: string;
  size: number;
  /** Caminho no bucket `mail-attachments`. `null` quando não há bytes. */
  path: string | null;
  /** Preenchido exatamente quando `path` é `null`. */
  skipped: MailAttachmentSkip | null;
  /**
   * O ficheiro da Cloud interna, quando alguém já guardou este anexo. Escrito
   * por `mail_attachment_saved_to_cloud()` e lido pelo leitor para dizer "já
   * está na Cloud" em vez de oferecer uma segunda cópia.
   */
  cloudFileId: string | null;
};

/**
 * O que o worker escreve. Não leva `cloudFileId` de propósito: esse campo nasce
 * mais tarde, quando alguém guarda o anexo na Cloud interna, e quem o escreve é
 * `mail_attachment_saved_to_cloud()`. O worker não tem nada a dizer sobre ele —
 * e o tipo é o que garante que não o inventa a `null` por descuido.
 */
export type MailAttachmentStored = Omit<MailAttachment, "cloudFileId">;

/**
 * `mail_messages.attachments` é `jsonb` e, para as mensagens que entraram antes
 * desta tarefa, traz só `{ filename, contentType, size }`. Ler é por aqui e
 * nunca por `as`: uma mensagem antiga tem de aparecer no leitor como anexo sem
 * bytes, não fazer o ecrã rebentar.
 */
export function readMailAttachments(value: unknown): MailAttachment[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const row = entry as Record<string, unknown>;
    const path = typeof row.path === "string" && row.path ? row.path : null;
    const skipped =
      typeof row.skipped === "string" &&
      (MAIL_ATTACHMENT_SKIPS as readonly string[]).includes(row.skipped)
        ? (row.skipped as MailAttachmentSkip)
        : null;

    return [
      {
        filename: typeof row.filename === "string" && row.filename ? row.filename : "anexo",
        contentType: typeof row.contentType === "string" ? row.contentType : "",
        size: typeof row.size === "number" && Number.isFinite(row.size) ? row.size : 0,
        path,
        // Sem caminho e sem razão: é uma mensagem de antes de D66 estar paga.
        skipped: path ? null : (skipped ?? "error"),
        cloudFileId: typeof row.cloud_file_id === "string" ? row.cloud_file_id : null,
      },
    ];
  });
}

export function isMailAttachmentMime(mime: string): mime is MailAttachmentMime {
  return (MAIL_ATTACHMENT_MIMES as readonly string[]).includes(mime);
}

/**
 * A assinatura de conteúdo, quando o formato tem uma
 * =========================================================================
 * 07 §19.8 #2 manda decidir pelos primeiros bytes e não pelo que o remetente
 * declara — e num e-mail o `Content-Type` é escrito por quem envia, que é
 * precisamente quem não é de confiança.
 *
 * Mas metade desta lista **não tem** assinatura: um `.txt` e um `.csv` são
 * texto, e exigir-lhes bytes mágicos seria recusar os dois sempre. A regra que
 * fica é a honesta: **quem tem assinatura tem de a cumprir** (um `.docx` que
 * não seja um zip não passa), e quem não tem entra pelo tipo declarado, já
 * dentro da lista fechada. O que isto garante não é "o ficheiro é inofensivo" —
 * garante que ninguém põe um executável no bucket com nome de folha de cálculo.
 *
 * As famílias, e não os MIME: `docx`, `xlsx` e `zip` são todos um zip, e
 * `doc`/`xls` são ambos um contentor OLE. Distingui-los pelos bytes exigiria
 * abrir o contentor, que é trabalho a sério para ganho nenhum.
 */
const SIGNATURES: { family: string; magic: number[] }[] = [
  { family: "pdf", magic: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { family: "png", magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { family: "jpeg", magic: [0xff, 0xd8, 0xff] },
  { family: "gif", magic: [0x47, 0x49, 0x46, 0x38] }, // GIF8
  { family: "zip", magic: [0x50, 0x4b, 0x03, 0x04] }, // PK..
  { family: "zip", magic: [0x50, 0x4b, 0x05, 0x06] }, // zip vazio
  { family: "ole", magic: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }, // .doc/.xls
];

/** `webp` é RIFF com o tipo no 9.º byte, e por isso não cabe na tabela acima. */
function isWebp(bytes: Uint8Array): boolean {
  const riff = [0x52, 0x49, 0x46, 0x46];
  const webp = [0x57, 0x45, 0x42, 0x50];
  return (
    riff.every((byte, index) => bytes[index] === byte) &&
    webp.every((byte, index) => bytes[8 + index] === byte)
  );
}

/** `null` quando os bytes não correspondem a nenhuma família conhecida. */
export function sniffAttachmentFamily(bytes: Uint8Array): string | null {
  if (isWebp(bytes)) return "webp";
  for (const { family, magic } of SIGNATURES) {
    if (magic.every((byte, index) => bytes[index] === byte)) return family;
  }
  return null;
}

/** A família que cada tipo aceito tem de apresentar. `null` = não tem nenhuma. */
const EXPECTED_FAMILY: Record<MailAttachmentMime, string | null> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "text/plain": null,
  "text/csv": null,
  "application/msword": "ole",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "zip",
  "application/vnd.ms-excel": "ole",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "zip",
  "application/zip": "zip",
};

/**
 * O tipo com que o anexo entra no bucket, ou `null` para o recusar.
 *
 * Normaliza o que vem do cabeçalho (`Text/PLAIN; charset=utf-8` → `text/plain`)
 * antes de o comparar: um parâmetro de charset não é um tipo diferente.
 */
export function resolveAttachmentMime(
  declared: string | undefined,
  bytes: Uint8Array,
): MailAttachmentMime | null {
  const mime = (declared ?? "").split(";")[0]!.trim().toLowerCase();
  if (!isMailAttachmentMime(mime)) return null;

  const expected = EXPECTED_FAMILY[mime];
  if (expected === null) return mime;

  return sniffAttachmentFamily(bytes) === expected ? mime : null;
}

/**
 * O caminho no bucket: `{mailbox_id}/{message_id}/{índice}-{nome}`.
 *
 * O primeiro segmento é a caixa, como em `ticket-screenshots` o primeiro é o
 * dono — é o que uma policy sabe ler sem abrir o jsonb. O índice vai à frente
 * do nome porque dois anexos com o mesmo nome na mesma mensagem acontecem (três
 * `scan.pdf` de um digitalizador) e sem ele o segundo apagava o primeiro.
 */
export function mailAttachmentPath(
  mailboxId: string,
  messageId: string,
  index: number,
  filename: string,
): string {
  return `${mailboxId}/${messageId}/${index}-${safeFilename(filename)}`;
}

/**
 * O nome do ficheiro reduzido ao que o Storage aceita como chave. Acentos,
 * barras e espaços saem; o nome que a pessoa vê continua a ser o da lista, que
 * é guardado tal como veio.
 *
 * As duas últimas linhas não são cosmética: um anexo pode chegar chamado
 * `../../etc/passwd` — é texto escrito por quem envia — e o caminho resultante
 * nunca pode conter um `..` que algum cliente de Storage interprete como subir
 * um nível. As barras já saíram na linha de cima; estas tiram os pontos
 * seguidos e qualquer ponto ou traço à cabeça.
 */
export function safeFilename(filename: string): string {
  const clean = filename
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 100);
  return clean || "anexo";
}
