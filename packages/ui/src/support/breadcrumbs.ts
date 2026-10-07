/**
 * Captura técnica automática (P10-01 · 04 §2.7 #2)
 * =========================================================================
 * O que o cliente junta a um relato sem o utilizador escrever nada: rota,
 * build, browser/SO, viewport, rede, sessão, as últimas ~20 ações e os erros
 * de consola.
 *
 * **A regra que manda neste ficheiro é uma só, e é de privacidade:** nunca
 * conteúdo. Um breadcrumb diz "clicou em *Guardar*" e "navegou para
 * `/mensagens`"; não diz o que a mensagem dizia. Por isso o coletor **não** lê
 * `value` de inputs, **não** lê `textContent` de containers e **não** guarda a
 * query string de um URL — uma pesquisa no Market é o que a pessoa procura, e
 * isso é dela.
 *
 * Vive em `packages/ui` e não em `packages/db` porque é código de browser:
 * toca `window`, `document` e `navigator`. `packages/db` corre no servidor.
 *
 * A retenção é de 90 dias e é a base de dados que a aplica (decisão do cliente
 * de 7 out 2026, 07 §24.1) — aqui só se recolhe.
 */

export type Breadcrumb = {
  at: string;
  kind: "navigation" | "click" | "error";
  label: string;
};

export type TechnicalSnapshot = {
  route?: string;
  buildSha?: string;
  browser?: string;
  os?: string;
  viewport?: string;
  network?: string;
  sessionId?: string;
  breadcrumbs?: Breadcrumb[];
  consoleErrors?: string[];
};

/** 04 §2.7 #2 diz "últimas ~20 ações". Vinte é o número. */
const MAX_BREADCRUMBS = 20;
const MAX_CONSOLE_ERRORS = 20;
const MAX_LABEL = 200;

const trail: Breadcrumb[] = [];
const consoleErrors: string[] = [];
let installed = false;

function push(entry: Breadcrumb) {
  trail.push(entry);
  if (trail.length > MAX_BREADCRUMBS) trail.shift();
}

function clamp(value: string, max = MAX_LABEL): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * O caminho, **sem query string e sem fragmento**. `/market?q=lisboa` fica
 * `/market`: o que interessa ao Suporte é o ecrã, e o resto é o que a pessoa
 * andava a procurar.
 */
function pathOnly(href: string): string {
  try {
    return new URL(href, "http://local").pathname;
  } catch {
    return href.replace(/[?#].*$/, "");
  }
}

/**
 * O rótulo de um clique, lido só de sítios que são **interface e não dados**:
 * `aria-label`, `title`, o texto do próprio elemento clicável quando é curto, e
 * em último caso o nome da tag. Um `textContent` de um cartão de imóvel traria
 * o preço e a morada; o de um botão traz "Guardar".
 */
function labelFor(element: Element): string {
  const aria = element.getAttribute("aria-label");
  if (aria) return clamp(aria, 80);

  const title = element.getAttribute("title");
  if (title) return clamp(title, 80);

  const own = (element as HTMLElement).innerText ?? "";
  // 60 caracteres é um rótulo de botão. Acima disso é conteúdo, e não se leva.
  if (own && own.length <= 60) return clamp(own, 60);

  const testId = element.getAttribute("data-testid");
  if (testId) return clamp(testId, 60);

  return element.tagName.toLowerCase();
}

/**
 * Liga os ouvintes. Idempotente — chamada no shell de cada app, que monta uma
 * vez, mas uma segunda chamada não duplica nada.
 */
export function installBreadcrumbs(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  push({ at: new Date().toISOString(), kind: "navigation", label: pathOnly(location.href) });

  // `click` na captura, para registar mesmo quando o handler do componente
  // chama `stopPropagation` — o que acontece em modais e menus, que são
  // precisamente onde os problemas aparecem.
  window.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const clickable = target.closest("button, a, [role='button'], [role='tab'], summary");
      if (!clickable) return;
      push({ at: new Date().toISOString(), kind: "click", label: labelFor(clickable) });
    },
    { capture: true, passive: true },
  );

  // O App Router navega sem recarregar: sem isto, a trilha teria uma só
  // navegação — a do primeiro carregamento.
  const record = () =>
    push({ at: new Date().toISOString(), kind: "navigation", label: pathOnly(location.href) });

  for (const method of ["pushState", "replaceState"] as const) {
    const original = history[method];
    history[method] = function patched(this: History, ...args: Parameters<History["pushState"]>) {
      const result = original.apply(this, args);
      record();
      return result;
    };
  }
  window.addEventListener("popstate", record, { passive: true });

  // Os erros de 04 §2.7 #3. A mensagem e o sítio; nunca o `stack` inteiro, que
  // em dev traz caminhos de ficheiros da máquina de quem desenvolve.
  window.addEventListener("error", (event) => {
    const where = event.filename ? ` (${pathOnly(event.filename)}:${event.lineno})` : "";
    const message = clamp(`${event.message}${where}`, 500);
    if (consoleErrors.length < MAX_CONSOLE_ERRORS) consoleErrors.push(message);
    push({ at: new Date().toISOString(), kind: "error", label: clamp(event.message, 120) });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message = clamp(
      `Unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}`,
      500,
    );
    if (consoleErrors.length < MAX_CONSOLE_ERRORS) consoleErrors.push(message);
    push({ at: new Date().toISOString(), kind: "error", label: clamp(message, 120) });
  });
}

type NetworkInformation = { effectiveType?: string; downlink?: number };

function networkLabel(): string | undefined {
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (!connection?.effectiveType) return navigator.onLine ? undefined : "offline";
  return navigator.onLine ? connection.effectiveType : "offline";
}

/**
 * O retrato no momento em que o modal abre. Lê-se aqui e não no servidor: o
 * servidor não sabe o viewport nem a rede, e o `user-agent` do cabeçalho é
 * menos fiável do que `navigator.userAgentData`.
 *
 * `sessionId` é o id da sessão **de navegação**, não da sessão de autenticação:
 * serve para ligar dois relatos do mesmo separador. Vive em `sessionStorage`,
 * logo morre com o separador, e é um UUID sem relação com a conta.
 */
export function captureTechnicalSnapshot(buildSha?: string): TechnicalSnapshot {
  if (typeof window === "undefined") return {};

  let sessionId: string | undefined;
  try {
    const key = "upm.support.session";
    sessionId = sessionStorage.getItem(key) ?? undefined;
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem(key, sessionId);
    }
  } catch {
    // Janela privada ou armazenamento bloqueado. Um relato sem `sessionId` é
    // um relato bom; falhar por causa disto não era.
    sessionId = undefined;
  }

  const agent = (
    navigator as Navigator & {
      userAgentData?: { brands?: { brand: string; version: string }[]; platform?: string };
    }
  ).userAgentData;

  const browser = agent?.brands?.length
    ? agent.brands.map((b) => `${b.brand} ${b.version}`).join(", ")
    : navigator.userAgent;

  return {
    route: pathOnly(location.href),
    buildSha,
    browser: clamp(browser, 200),
    os: clamp(agent?.platform ?? navigator.platform ?? "", 120) || undefined,
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    network: networkLabel(),
    sessionId,
    breadcrumbs: trail.slice(-MAX_BREADCRUMBS),
    consoleErrors: consoleErrors.slice(-MAX_CONSOLE_ERRORS),
  };
}
