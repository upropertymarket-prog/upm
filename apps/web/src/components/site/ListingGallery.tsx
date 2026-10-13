"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

/**
 * Galeria com lightbox do detalhe público (P2-05 · 04 §2.1 · 04 §1.7)
 * =========================================================================
 * Uma foto grande e as seguintes em tira; clicar abre a lightbox. O que 04
 * §1.7 exige de um diálogo está aqui: fecha com `Esc`, as setas navegam, o
 * foco vai para o botão de fechar ao abrir e volta à miniatura ao sair, e o
 * fundo é `aria-hidden` para quem usa leitor de ecrã.
 *
 * Escrito à mão e não com uma biblioteca: a página é pública e é medida pelo
 * Lighthouse (04 §2.1 AC), e uma lightbox são trinta linhas — não vale mais
 * uma dependência no bundle de um detalhe de propriedade.
 *
 * `<img>` e não `next/image`: os URL são assinados e expiram. A nota completa
 * está em `ListingCard.tsx`.
 *
 * **O enquadramento é o do `PropertyDetail` da app, à medida** (13 out 2026):
 * capa a 3fr à esquerda, três miniaturas empilhadas a 1fr à direita, altura
 * `clamp(220px, 46vw, 360px)`, cantos a 16 e 10. Antes era capa em 16/9 com
 * uma tira de miniaturas por baixo — bonito, mas era **outra** galeria, e
 * quem entrasse na conta a ver este anúncio dava com um ecrã diferente a
 * mostrar a mesma propriedade. A lightbox é o que esta tem a mais, e isso não
 * muda o enquadramento: só acrescenta ao clique.
 */

/**
 * A medida do `PropertyDetail`, repetida aqui de propósito e não aproximada.
 *
 * Exportada porque o `ListingDetail` alinha o cartão de preço por ela: as duas
 * peças do topo do detalhe — galeria à esquerda, cartão de ação à direita —
 * têm de fechar à mesma linha, e um número solto nos dois ficheiros voltava a
 * divergir à primeira alteração.
 */
export const LISTING_MEDIA_HEIGHT = "clamp(220px, 46vw, 360px)";

const GALLERY_HEIGHT = LISTING_MEDIA_HEIGHT;
export function ListingGallery({ photos, title }: { photos: string[]; title: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);
  const step = useCallback(
    (delta: number) =>
      setOpenIndex((current) =>
        current === null ? null : (current + delta + photos.length) % photos.length,
      ),
    [photos.length],
  );

  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    // Sem isto, o fundo rola por trás da lightbox — o diálogo ficava a flutuar
    // sobre uma página em movimento.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [openIndex, close, step]);

  if (photos.length === 0) {
    return (
      <div
        style={{
          height: GALLERY_HEIGHT,
          borderRadius: 16,
          border: "1px solid var(--border)",
          background: "var(--surface2)",
          display: "grid",
          placeItems: "center",
          color: "var(--muted)",
          fontSize: "var(--fs-body)",
        }}
      >
        Este anúncio ainda não tem fotografias.
      </div>
    );
  }

  const [cover, ...rest] = photos;

  return (
    <>
      {/* Mesma grelha do `PropertyDetail` da app: capa a 3fr, tira de
          miniaturas a 1fr com um mínimo de 84 px, e a altura fluida em vez de
          proporção. Ver a nota de topo sobre porque é a mesma e não parecida. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 3fr) minmax(84px, 1fr)",
          gap: 8,
          height: GALLERY_HEIGHT,
        }}
      >
        <button
          type="button"
          onClick={() => setOpenIndex(0)}
          aria-label={`Ver fotografia 1 de ${photos.length} em tamanho grande`}
          style={{
            padding: 0,
            border: 0,
            borderRadius: 16,
            overflow: "hidden",
            background: "none",
            cursor: "pointer",
            display: "block",
            height: "100%",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- URL assinado, expira. */}
          <img
            src={cover}
            alt={`${title} — fotografia principal`}
            width={1280}
            height={720}
            style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
          />
        </button>

        {/* Só três: a quarta miniatura deixava cada uma com menos de 80 px de
            altura na moldura de 360 px, e a lightbox dá acesso às restantes. */}
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            overflow: "hidden",
          }}
        >
          {rest.slice(0, 3).map((photo, index) => (
            <li key={photo} style={{ flex: 1, minHeight: 0 }}>
              <button
                type="button"
                onClick={() => setOpenIndex(index + 1)}
                aria-label={`Ver fotografia ${index + 2} de ${photos.length} em tamanho grande`}
                style={{
                  padding: 0,
                  border: 0,
                  borderRadius: 10,
                  overflow: "hidden",
                  background: "none",
                  cursor: "pointer",
                  display: "block",
                  width: "100%",
                  height: "100%",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- URL assinado, expira. */}
                <img
                  src={photo}
                  alt=""
                  width={320}
                  height={240}
                  loading="lazy"
                  decoding="async"
                  style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
                />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {openIndex !== null ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${title} — fotografia ${openIndex + 1} de ${photos.length}`}
          onClick={close}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(5, 10, 22, 0.92)",
            display: "grid",
            gridTemplateRows: "auto 1fr",
            gap: "var(--sp-4)",
            padding: "var(--sp-5)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#fff", fontSize: "var(--fs-body)" }}>
              {openIndex + 1} / {photos.length}
            </span>
            <button
              type="button"
              autoFocus
              onClick={close}
              aria-label="Fechar"
              className="upm-btn upm-btn--secondary upm-btn--icon"
            >
              <X size={18} />
            </button>
          </div>

          {/* O clique no véu fecha; o clique na imagem e nas setas não deve. */}
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr auto",
              gap: "var(--sp-4)",
              alignItems: "center",
              minHeight: 0,
            }}
          >
            {photos.length > 1 ? (
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="Fotografia anterior"
                className="upm-btn upm-btn--secondary upm-btn--icon"
              >
                <ChevronLeft size={18} />
              </button>
            ) : (
              <span />
            )}

            {/* eslint-disable-next-line @next/next/no-img-element -- URL assinado, expira. */}
            <img
              src={photos[openIndex]}
              alt={`${title} — fotografia ${openIndex + 1}`}
              style={{
                display: "block",
                maxWidth: "100%",
                maxHeight: "100%",
                margin: "0 auto",
                objectFit: "contain",
                borderRadius: "var(--r-md)",
              }}
            />

            {photos.length > 1 ? (
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Fotografia seguinte"
                className="upm-btn upm-btn--secondary upm-btn--icon"
              >
                <ChevronRight size={18} />
              </button>
            ) : (
              <span />
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
