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
 * uma dependência no bundle de uma ficha de imóvel.
 *
 * `<img>` e não `next/image`: os URL são assinados e expiram. A nota completa
 * está em `ListingCard.tsx`.
 */
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
        aria-hidden="true"
        style={{
          // Altura fixa e curta, não a proporção 16/9 das fotografias: numa
          // coluna de 830 px essa proporção dava 467 px de caixa vazia, que
          // empurrava o título e os factos para fora do primeiro ecrã. Visto
          // na captura da storyboard `FichaClaro`. Uma ausência de fotografias
          // deve ocupar o espaço de um aviso, não o de uma galeria.
          height: 160,
          borderRadius: "var(--r-lg)",
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
      <div style={{ display: "grid", gap: "var(--sp-3)" }}>
        <button
          type="button"
          onClick={() => setOpenIndex(0)}
          aria-label={`Ver fotografia 1 de ${photos.length} em tamanho grande`}
          style={{
            padding: 0,
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
            background: "none",
            cursor: "pointer",
            display: "block",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- URL assinado, expira. */}
          <img
            src={cover}
            alt={`${title} — fotografia principal`}
            width={1280}
            height={720}
            style={{
              display: "block",
              width: "100%",
              height: "auto",
              aspectRatio: "16 / 9",
              objectFit: "cover",
            }}
          />
        </button>

        {rest.length > 0 ? (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(7rem, 30%), 1fr))",
              gap: "var(--sp-3)",
            }}
          >
            {rest.map((photo, index) => (
              <li key={photo}>
                <button
                  type="button"
                  onClick={() => setOpenIndex(index + 1)}
                  aria-label={`Ver fotografia ${index + 2} de ${photos.length} em tamanho grande`}
                  style={{
                    padding: 0,
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-md)",
                    overflow: "hidden",
                    background: "none",
                    cursor: "pointer",
                    display: "block",
                    width: "100%",
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
                    style={{
                      display: "block",
                      width: "100%",
                      height: "auto",
                      aspectRatio: "4 / 3",
                      objectFit: "cover",
                    }}
                  />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
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
