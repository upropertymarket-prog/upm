"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";

import { FAQ_IDS } from "../../lib/site-content";

/**
 * Dúvidas — acordeão com título sticky (P2-01 · 04 §2.1)
 * =========================================================================
 * Acordeão escrito à mão e não `<details>`: 04 §1.7 pede foco visível e
 * navegação por teclado, e o `<summary>` nativo não deixa controlar o estado
 * para fechar os outros ao abrir um — que é o comportamento do protótipo.
 *
 * Uma pergunta aberta de cada vez. Com todas abertas a secção fica com três
 * ecrãs de altura e deixa de se poder varrer.
 */
export function Faq() {
  const t = useTranslations("site.faq");
  const [open, setOpen] = useState<number | null>(0);

  return (
    // As colunas e o `sticky` estão em `site.css` (`.upm-faq`): o título só
    // cola quando está ao lado das perguntas. Empilhado, as perguntas passavam
    // por trás dele ao rolar (cliente, 11 nov 2026).
    <div
      className="upm-faq"
      style={{
        display: "grid",
        gap: "clamp(1.5rem, 4vw, 3rem)",
        alignItems: "start",
      }}
    >
      {/* `maxWidth`: o texto fica com a sua medida de leitura e não estica até
          às perguntas, como no desenho do cliente (8 nov 2026). */}
      <header
        className="upm-faq__intro"
        style={{
          display: "grid",
          gap: "var(--sp-3)",
          maxWidth: "26rem",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontSize: "clamp(1.4rem, 3.4vw, 2.5rem)",
            lineHeight: 1.15,
            color: "var(--text)",
          }}
        >
          {t("title")}
        </h2>
        <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.6, color: "var(--muted)" }}>
          {t("body")}
        </p>
      </header>

      {/* 12 px entre perguntas (eram 6, 11 nov 2026): são cartões com contorno,
          e a 6 px liam-se como uma tabela. Menos do que os 20–24 px dos outros
          cartões porque é uma lista de itens da mesma coisa. */}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "var(--sp-5)" }}>
        {FAQ_IDS.map((itemId, index) => {
          const isOpen = open === index;
          const panelId = `faq-panel-${index}`;
          const buttonId = `faq-button-${index}`;
          return (
            <li
              key={itemId}
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md)",
                background: "var(--surface)",
                overflow: "hidden",
              }}
            >
              <h3 style={{ margin: 0 }}>
                <button
                  type="button"
                  id={buttonId}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpen(isOpen ? null : index)}
                  style={{
                    width: "100%",
                    display: "flex",
                    gap: "var(--sp-3)",
                    alignItems: "center",
                    justifyContent: "space-between",
                    textAlign: "left",
                    // 44 px de alvo: é um controlo de toque grande numa
                    // página pública, não uma ação dentro de uma lista densa.
                    minHeight: "44px",
                    padding: "var(--sp-7)",
                    background: "transparent",
                    border: "none",
                    font: "inherit",
                    fontSize: "14.5px",
                    fontWeight: "var(--fw-semibold)",
                    color: "var(--text)",
                    cursor: "pointer",
                  }}
                >
                  {t(`items.${itemId}.q`)}
                  <ChevronDown
                    size={17}
                    aria-hidden="true"
                    style={{
                      flexShrink: 0,
                      color: "var(--muted)",
                      transform: isOpen ? "rotate(180deg)" : undefined,
                      transition: "transform 150ms ease",
                    }}
                  />
                </button>
              </h3>
              {isOpen ? (
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  style={{
                    padding: "0 var(--sp-7) var(--sp-7)",
                    fontSize: "14px",
                    lineHeight: 1.6,
                    color: "var(--muted)",
                  }}
                >
                  {t(`items.${itemId}.a`)}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
