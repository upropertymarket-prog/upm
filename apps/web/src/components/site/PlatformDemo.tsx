"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";

/**
 * Demonstração interativa da plataforma — `/#plataforma` (P2-04 · 07 §7)
 * =========================================================================
 * O lugar desta secção estava reservado desde P2-01 com uma caixa 16/10 vazia e
 * um comentário a dizer "a demonstração interativa é P2-04 e ainda não existe".
 * É o que isto substitui.
 *
 * ## O que 07 §7 decidiu, e que este ficheiro cumpre
 *
 * **"A demo não toca na app autenticada."** O plano de implementação ainda
 * descreve P2-04 como "usa rotas `?demo=1` das apps"; 07 §7 revogou-o e é a
 * decisão que vale: *"a rota `?demo=1` em app.upropertymarket.pt é eliminada.
 * Era a única via de expor rotas autenticadas ao público, e não vale o risco."*
 * Daí os ecrãs montarem-se aqui, em `apps/web`, com os componentes reais de
 * `@upm/ui` e as fixtures de `@upm/ui/demo-data` — sem sessão, sem cliente
 * Supabase, sem um pedido de rede, sem RLS no caminho.
 *
 * **Os dois separadores ficam montados ao mesmo tempo.** 07 §7 pede-os
 * "pré-carregados para não haver ecrã branco na troca", e é por isso que o
 * separador inativo é escondido com `hidden` em vez de deixar de ser
 * renderizado: um `{activo === "x" ? <A/> : <B/>}` desmonta a árvore e a troca
 * passa a ter um instante em branco enquanto o shell volta a montar. O custo é
 * montar dois shells; o ganho é a troca ser instantânea, que é precisamente o
 * que a decisão pede — e, desde que o menu da demonstração navega, é também o
 * que faz cada perfil guardar a secção onde ia.
 *
 * `hidden` (o atributo) e não `display: none` à mão: tira o conteúdo da árvore
 * de acessibilidade e da ordem de tabulação ao mesmo tempo, que é o que impede
 * o teclado de entrar num separador que não se está a ver.
 *
 * **O tema da demo é independente do tema do site.** Também de 07 §7. O
 * `data-theme="light"` fixo no envoltório faz com que os tokens resolvam
 * sempre em claro lá dentro, mesmo que o visitante esteja a ver o site em
 * escuro — o atributo mais próximo é o que manda. É deliberado: o que se está a
 * mostrar é o produto, não mais uma superfície do site, e o enquadramento
 * neutro à volta (`--surface2`) é o que 05 §1.1 chama "fundo neutro".
 *
 * ## As duas armadilhas de embeber o `AppShell`
 *
 * O shell foi escrito para ocupar uma janela, não uma caixa dentro de uma
 * página, e isso dá dois problemas que não são óbvios:
 *
 *  1. **`.upm-shell` tem `min-height: 100vh`** (`shell.css`). Dentro desta
 *     caixa isso daria um shell da altura do ecrã inteiro a transbordar de uma
 *     moldura de 560 px. Passa-se `minHeight: "100%"` por `style`, que é o uso
 *     que o próprio componente prevê ("o `style` existe para o consumidor
 *     ajustar o que precisar"). **Não se lhe dá uma altura em pixels** — o
 *     aviso no `AppShell` é explícito sobre o que isso parte: topbar comprimida
 *     e faixas vazias.
 *  2. **`.upm-sidebar` é `position: fixed`.** Sem contenção, a sidebar da demo
 *     colava-se ao viewport do browser e flutuava por cima da home inteira. O
 *     `transform: translateZ(0)` no envoltório resolve-o pela regra da CSS que
 *     diz que um elemento transformado passa a ser o bloco de contenção dos
 *     descendentes `fixed` — a sidebar passa a ser fixa *em relação à caixa da
 *     demo*, que é o que se quer.
 *
 * Nada disto precisou de tocar no `AppShell`: o shell que a demo mostra é, à
 * letra, o mesmo que o produto usa.
 */

/**
 * Só os ids. Os rótulos são "Proprietário" e "Comprador", que já são o
 * `roles` do ficheiro de mensagens — e uma constante de módulo ficava presa ao
 * idioma em que foi escrita (D72).
 */
const TAB_IDS = ["owner", "buyer"] as const;

export type TabId = (typeof TAB_IDS)[number];

/**
 * Os ecrãs vêm num chunk próprio, e só quando a secção se aproxima do ecrã.
 *
 * Arrastam o `AppShell` inteiro e as fixtures. Num ficheiro só, esse peso
 * entrava no chunk da home — descarregado e interpretado por toda a gente que
 * abre o site, inclusive quem nunca desce até aqui. `ssr: false` porque não há
 * nada nesta demonstração que valha a pena ter no HTML servido: são dados
 * inventados, não conteúdo para indexar.
 */
const PlatformDemoScreens = dynamic(() => import("./PlatformDemoScreens"), { ssr: false });

/**
 * Monta a demo só quando ela se aproxima do ecrã.
 *
 * **Não contradiz o "pré-carregados" de 07 §7, serve-o.** A exigência é não
 * haver ecrã branco *ao trocar de separador*; para trocar, é preciso ver os
 * botões, e quando se veem os botões já os dois shells estão montados — o
 * observador dispara 400 px antes. O que isto evita é o custo noutro sítio: a
 * demo são dois `AppShell` completos, e montá-los no primeiro paint carrega-os
 * sobre a home, que é precisamente a página onde o AC de P2-06 mede Lighthouse
 * ≥ 90. Dois shells a hidratar acima do tempo de interação é trabalho pago por
 * toda a gente que abre o site, inclusive quem nunca chega a esta secção.
 *
 * Uma vez montada, fica — o `true` nunca volta a `false`.
 *
 * Sem `IntersectionObserver` (browser antigo, ou o observador indisponível),
 * monta já: mais vale a demo pesada do que a demo ausente.
 */
function useNearViewport<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    if (near) return;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNear(true);
      },
      { rootMargin: "400px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [near]);

  return { ref, near };
}

export function PlatformDemo() {
  const t = useTranslations("site.demo");
  const tRoles = useTranslations("roles");
  const [active, setActive] = useState<TabId>("owner");
  const { ref, near } = useNearViewport<HTMLDivElement>();

  return (
    <div ref={ref} style={{ display: "grid", gap: "var(--sp-5)", rowGap: "16px" }}>
      <div
        role="tablist"
        aria-label={t("profilesLabel")}
        style={{
          display: "flex",
          gap: "var(--sp-3)",
          flexWrap: "wrap",
          // Mais ar entre os botões e o simulador (cliente, 11 nov 2026):
          // somado ao `gap` da grelha dá 24 px. Aqui e não no `gap`, para a
          // nota por baixo do simulador continuar encostada a ele.
          marginBottom: "var(--sp-5)",
        }}
      >
        {TAB_IDS.map((tabId) => (
          <button
            key={tabId}
            type="button"
            role="tab"
            id={`demo-tab-${tabId}`}
            aria-selected={active === tabId}
            aria-controls={`demo-panel-${tabId}`}
            onClick={() => setActive(tabId)}
            className={`upm-btn upm-btn--${active === tabId ? "primary" : "secondary"} upm-btn--md`}
          >
            {tRoles(tabId)}
          </button>
        ))}
      </div>

      {/* O envoltório da demo. `data-theme` fixo e `data-app` da app (não
          "web"): lá dentro a tipografia tem de ser a da plataforma, não a do
          site público, que 07 §3 sobe para 14 px. `translateZ(0)` é o que
          prende a sidebar `fixed` a esta caixa — ver a nota do ficheiro. */}
      <div
        data-theme="light"
        style={{
          /* Subiu de `clamp(420px, 56vw, 620px)` a 27 out 2026, com os ecrãs
             navegáveis: o Painel tem quatro blocos e, na altura anterior, o
             primeiro que se via era meia fila de KPI. Continua a rolar por
             dentro — o que não pode é obrigar a rolar para ver o início. */
          height: "clamp(460px, 60vw, 700px)",
          overflow: "hidden",
          borderRadius: "var(--r-lg)",
          border: "1px solid var(--border)",
          background: "var(--surface2)",
          transform: "translateZ(0)",
          contain: "paint",
        }}
      >
        {near ? <PlatformDemoScreens active={active} /> : null}
      </div>

      <p style={{ margin: 0, fontSize: "var(--fs-label)", color: "var(--muted)" }}>
        {t("disclaimer")}
      </p>
    </div>
  );
}
