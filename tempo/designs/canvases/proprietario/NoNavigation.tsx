"use client";

/**
 * Trava a navegação dentro de uma storyboard.
 * =========================================================================
 * As storyboards montam os componentes verdadeiros, e os componentes
 * verdadeiros têm links verdadeiros: "← Voltar ao Market", os cartões do
 * Market, "Editar" e "Estatísticas" da barra do próprio anúncio. Em modo
 * interativo um clique nesses links navega o iframe para uma rota que o
 * devserver do canvas não serve — e a storyboard fica presa num 404, sem
 * forma óbvia de voltar atrás.
 *
 * Travar o clique aqui, no invólucro do canvas, e não nos componentes: na app
 * esses links têm de funcionar. O que não se quer é navegar *a partir de uma
 * maqueta*, e isso é uma propriedade do canvas, não do produto.
 *
 * Só trava o que navegaria para fora. Botões, toggles, menus e modais
 * continuam a responder, que é o que torna o modo interativo útil.
 */
export function NoNavigation({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{ display: "contents" }}
      onClickCapture={(event) => {
        const link = (event.target as HTMLElement | null)?.closest?.("a[href]");
        if (!link) return;
        const href = link.getAttribute("href") ?? "";
        // Âncoras dentro da própria página (`#...`) não saem do sítio.
        if (href.startsWith("#")) return;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {children}
    </div>
  );
}
