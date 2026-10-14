"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "../components/Button";
import { Modal } from "../components/Overlay";

/**
 * Novidades nas apps — modal e faixa (P10-07 · 04 §8.1.3)
 * =========================================================================
 * Vive em `@upm/ui` e não na app por uma razão concreta: **o Marketing
 * pré-visualiza este ecrã antes de publicar** (04 §2.6 pede "pré-visualização
 * do modal com paginação e Entendi"), e uma pré-visualização que seja uma
 * segunda implementação do modal deixa de ser uma pré-visualização à primeira
 * alteração. É o mesmo arranjo do `ReportProblemModal`: um componente, duas
 * apps, etiquetas injetadas.
 *
 * Como lá, o estilo é `style` em linha com tokens e não classes: um componente
 * de `@upm/ui` não pode depender de uma folha de estilos de uma app, e tem de
 * montar também nas storyboards.
 *
 * ## As três entregas, e o que cada uma interrompe
 *
 * 04 §2.6 dá três, e a diferença entre elas é só **quando** cortam o caminho a
 * quem entrou para fazer outra coisa:
 *
 * - `banner` — faixa no topo agora, modal no próximo login;
 * - `next_login` — nada agora, modal no próximo login;
 * - `mandatory` — modal imediato e **sem "Mais tarde"**. É para o que não pode
 *   passar ao lado de ninguém, e por isso nem o botão de fechar existe.
 *
 * ## "Mais tarde" não marca nada, e é isso que o faz funcionar
 *
 * 04 §8.1.3: *"«Mais tarde» fecha e mostra uma faixa no topo com «Ver
 * novidades»"*. O que faz a novidade voltar no próximo login é precisamente
 * **não** escrever em `app_update_views` — não há um estado de "adiada" a
 * manter em lado nenhum, e por isso também não há como ele ficar errado.
 * "Entendi" é o único que marca, e marca só a que está no ecrã: quem lê duas de
 * três fica com duas marcadas e a terceira à espera.
 *
 * ## O corpo entra por `innerHTML`, e já vem sanitizado
 *
 * O HTML é sanitizado **na escrita**, no servidor (02 §4.3,
 * `sanitizeUpdateBody` em `@upm/db/updates`), que é a única altura em que vale
 * a pena: sanitizar na leitura deixa a linha gravada com o que lá foi posto e
 * depende de todos os leitores passarem pelo mesmo caminho. Não há `iframe`
 * aqui — ao contrário do e-mail recebido, este texto é **nosso**, escrito pela
 * nossa equipa, e um iframe impedia o modal de herdar os tokens do tema.
 */

export type AppUpdate = {
  id: string;
  version: string;
  title: string;
  bodyHtml: string;
  points: string[];
  /** URL já assinado pelo servidor; `null` quando a novidade não tem imagem. */
  imageUrl: string | null;
  imageAlt: string;
  delivery: "banner" | "next_login" | "mandatory";
};

export type AppUpdatesLabels = {
  /** "Novidades" — o título da janela, acima do título da novidade. */
  title: string;
  previous: string;
  next: string;
  /** "Entendi" — marca a novidade como vista. */
  acknowledge: string;
  /** "Mais tarde" — fecha sem marcar. Não aparece numa obrigatória. */
  later: string;
  close: string;
  /** "Ver novidades" — o botão da faixa. */
  openBanner: string;
  /** "Há novidades na sua conta." — o texto da faixa. */
  bannerText: string;
  /** "{current} de {total}" */
  counter: (current: number, total: number) => string;
};

export type AppUpdatesModalProps = {
  updates: AppUpdate[];
  labels: AppUpdatesLabels;
  /**
   * `true` abre o modal ao montar; `false` deixa só a faixa. É o que distingue
   * `mandatory` e `next_login` (que abrem) de `banner` (que não).
   */
  openOnMount: boolean;
  /** Marca uma novidade como vista. Nunca chamada pelo "Mais tarde". */
  onAcknowledge: (id: string) => void | Promise<void>;
};

export function AppUpdatesModal({
  updates,
  labels,
  openOnMount,
  onAcknowledge,
}: AppUpdatesModalProps) {
  const [open, setOpen] = useState(openOnMount);
  const [index, setIndex] = useState(0);
  /** As que já foram reconhecidas nesta sessão, para não voltarem na faixa. */
  const [done, setDone] = useState<string[]>([]);

  const pending = updates.filter((update) => !done.includes(update.id));
  const mandatory = pending.some((update) => update.delivery === "mandatory");
  const at = Math.min(index, Math.max(pending.length - 1, 0));
  const current = pending[at];

  // Uma obrigatória abre sempre, mesmo que a primeira da fila seja uma faixa:
  // basta uma no conjunto para o modal não poder ser adiado.
  useEffect(() => {
    if (mandatory) setOpen(true);
  }, [mandatory]);

  if (pending.length === 0 || !current) return null;

  async function acknowledge() {
    await onAcknowledge(current!.id);
    setDone((seen) => [...seen, current!.id]);
    // O índice recua uma casa em vez de avançar: a lista encurtou por baixo
    // dele e a seguinte passou a ocupar esta posição. Avançar saltava uma.
    setIndex((value) => Math.max(0, Math.min(value, pending.length - 2)));
  }

  return (
    <>
      {!open ? (
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "var(--sp-3)",
            padding: "var(--sp-3) var(--sp-4)",
            marginBottom: "var(--sp-5)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            background: "var(--accent-soft)",
            color: "var(--text)",
            fontSize: "13px",
          }}
        >
          <Sparkles size={16} aria-hidden="true" />
          {/* `minWidth: 0` é o que deixa o texto encolher em vez de empurrar o
              botão para fora da faixa em ecrãs estreitos — sem media queries. */}
          <span style={{ flex: 1, minWidth: 0 }}>{labels.bannerText}</span>
          <Button size="sm" onClick={() => setOpen(true)}>
            {labels.openBanner}
          </Button>
        </div>
      ) : null}

      <Modal
        open={open}
        // Uma obrigatória não tem como ser fechada: nem botão, nem `Esc`, nem
        // clique fora. É o que "modal imediato" de 04 §2.6 quer dizer.
        onClose={mandatory ? () => undefined : () => setOpen(false)}
        title={labels.title}
        subtitle={current.version || undefined}
        closeLabel={labels.close}
        size="md"
        footer={
          <>
            {pending.length > 1 ? (
              <span
                style={{
                  marginRight: "auto",
                  fontSize: "12.5px",
                  color: "var(--muted)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {labels.counter(at + 1, pending.length)}
              </span>
            ) : null}

            {pending.length > 1 ? (
              <>
                <Button
                  variant="secondary"
                  disabled={at === 0}
                  onClick={() => setIndex((value) => value - 1)}
                >
                  {labels.previous}
                </Button>
                <Button
                  variant="secondary"
                  disabled={at >= pending.length - 1}
                  onClick={() => setIndex((value) => value + 1)}
                >
                  {labels.next}
                </Button>
              </>
            ) : null}

            {!mandatory ? (
              <Button variant="ghost" onClick={() => setOpen(false)}>
                {labels.later}
              </Button>
            ) : null}
            <Button onClick={() => void acknowledge()}>{labels.acknowledge}</Button>
          </>
        }
      >
        <article style={{ display: "grid", gap: "var(--sp-5)" }}>
          {current.imageUrl ? (
            // Sem `next/image`: este componente é de `@upm/ui` e tem de montar
            // nas três apps e nas storyboards, onde não há loader configurado.
            // `packages/ui` não corre o plugin de ESLint do Next, por isso não
            // há aqui nada a desativar — e é por isso que a nota fica.
            <img
              src={current.imageUrl}
              alt={current.imageAlt}
              style={{
                width: "100%",
                height: "auto",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--border)",
              }}
            />
          ) : null}

          <h3
            style={{
              margin: 0,
              fontSize: "17px",
              lineHeight: 1.35,
              color: "var(--text)",
            }}
          >
            {current.title}
          </h3>

          {current.points.length > 0 ? (
            <ul
              style={{
                display: "grid",
                gap: "var(--sp-2)",
                margin: 0,
                paddingLeft: "var(--sp-5)",
                fontSize: "14px",
                lineHeight: 1.55,
                color: "var(--text)",
              }}
            >
              {current.points.map((point, position) => (
                <li key={position}>{point}</li>
              ))}
            </ul>
          ) : null}

          {current.bodyHtml ? (
            <div
              style={{ fontSize: "14px", lineHeight: 1.6, color: "var(--muted)" }}
              // Sanitizado na escrita, no servidor (ver a nota de topo).
              dangerouslySetInnerHTML={{ __html: current.bodyHtml }}
            />
          ) : null}
        </article>
      </Modal>
    </>
  );
}

/**
 * As etiquetas a partir do tradutor da app, como `reportProblemLabels`.
 *
 * O tipo do parâmetro é deliberadamente largo: o `Translator` do `next-intl` é
 * genérico sobre o mapa de mensagens e não encaixa numa assinatura estreita
 * sem obrigar cada chamador a um cast. `packages/ui` continua sem i18n —
 * recebe o tradutor, não o importa.
 */
export function appUpdatesLabels(t: (key: never, values?: never) => string): AppUpdatesLabels {
  const translate = t as unknown as (key: string, values?: Record<string, unknown>) => string;
  return {
    title: translate("updates.title"),
    previous: translate("updates.previous"),
    next: translate("updates.next"),
    acknowledge: translate("updates.acknowledge"),
    later: translate("updates.later"),
    close: translate("updates.close"),
    openBanner: translate("updates.openBanner"),
    bannerText: translate("updates.bannerText"),
    counter: (current, total) => translate("updates.counter", { current, total }),
  };
}
