import { ImageResponse } from "next/og";
import { resolveLocale } from "@upm/config";
import en from "@upm/config/messages/en.json";
import pt from "@upm/config/messages/pt.json";

import { getLaunchMode } from "@/lib/launch-mode";

/**
 * A imagem Open Graph por omissão — `/og/default.png` (P2-06 · fecha D63)
 * =========================================================================
 * É o cartão que aparece quando alguém partilha uma página do site no
 * WhatsApp, no LinkedIn, no Facebook ou no Slack. `buildMetadata` cai para
 * aqui sempre que uma rota não declara `ogImage` — e, por agora, nenhuma
 * declara.
 *
 * ## O desenho (decisão do cliente, 8 nov 2026)
 *
 * A fotografia da sala de estar — a mesma do topo do site, "sem comissões" —
 * com um degradê azul-noite à esquerda, e por cima o logótipo, a frase do site
 * e o endereço. No pré-lançamento leva ainda o selo "Pré-inscrição aberta",
 * que é o que se quer que quem recebe o link faça. Depois do lançamento o selo
 * sai sozinho (`getLaunchMode`), sem mexer aqui.
 *
 * Substituiu, a 8 nov, um cartão só de tipografia — feito quando o logótipo
 * da marca ainda não tinha sido entregue.
 *
 * ## Notas de implementação
 *
 * `ImageResponse` (Satori) desenha com um subconjunto de flexbox e **exige**
 * `display` explícito em qualquer elemento com mais de um filho. Não lê WebP:
 * por isso a fotografia tem uma cópia em JPEG, já no tamanho do cartão
 * (`public/site/og-fundo.jpg`, 1200×630).
 *
 * A fotografia e o logótipo pedem-se ao próprio site (`request.url`), e não
 * ao disco: na Vercel, `public/` é servido pela CDN e não vai dentro da
 * função. Os dois estão fora do middleware (ficheiros com extensão), por isso
 * respondem também em pré-lançamento.
 *
 * **As fontes vêm do Google Fonts, só com as letras do cartão.** As do site
 * são `woff2` variáveis (`packages/ui/src/fonts`), que o Satori não lê; o
 * Google devolve um TTF estático por peso quando o pedido não diz aceitar
 * `woff2`. Bricolage 700 no título e Manrope no resto, como no site (04 §5.3);
 * pesos até 700, o topo da escala do UPM. Se o Google não responder, o cartão
 * sai na fonte de omissão do Satori — pior, mas sai.
 *
 * `revalidate` de uma hora: o cartão é estático na prática, e o Next serve-o
 * de cache em vez de o voltar a desenhar a cada robô que passa — mas o selo
 * tem de sair pouco depois de o modo mudar.
 */

export const revalidate = 3600;

const WIDTH = 1200;
const HEIGHT = 630;
/** As famílias do site (04 §5.3): títulos e texto. */
const TITULOS = "Bricolage Grotesque";
const TEXTO = "#f8fafc";
/** A cor primária sobre fundo escuro — o `--accent` do tema escuro, o laranja do logótipo. */
const ACCENT_ON_DARK = "#f97316";

async function dataUrl(url: URL, type: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    // Só uma imagem a sério. Num endereço protegido (os `*.vercel.app`, que
    // pedem login à Vercel), o pedido volta com a página de login em HTML — e
    // o Satori, a tentar desenhá-la como imagem, rebentava o cartão com 500
    // (visto no primeiro deploy, 9 nov 2026). Sem a imagem, o cartão sai na
    // mesma, só sem fotografia.
    if (!(response.headers.get("content-type") ?? "").startsWith(type)) return null;
    let bytes = Buffer.from(await response.arrayBuffer());
    // O SVG do logótipo traz um manifesto C2PA de ~20 KB em `<metadata>`, que
    // não desenha nada: sai antes de o embutir.
    if (type === "image/svg+xml") {
      bytes = Buffer.from(bytes.toString("utf8").replace(/<metadata>[\s\S]*?<\/metadata>/, ""));
    }
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

type Font = { name: string; data: ArrayBuffer; weight: 500 | 600 | 700; style: "normal" };

async function googleFont(
  family: string,
  weight: Font["weight"],
  text: string,
): Promise<Font | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${family.replaceAll(" ", "+")}:wght@${weight}&text=${encodeURIComponent(text)}`,
    ).then((r) => (r.ok ? r.text() : ""));
    const src = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!src) return null;
    const font = await fetch(src);
    if (!font.ok) return null;
    return { name: family, data: await font.arrayBuffer(), weight, style: "normal" };
  } catch {
    return null;
  }
}

/**
 * O idioma vem do URL e não do cookie, e isso não é uma escolha de estilo: um
 * scraper de Open Graph — o do WhatsApp, o do LinkedIn, o do Slack — pede a
 * imagem sem cookies nenhuns. Se o idioma viesse do cookie, o cartão saía
 * sempre em português, mesmo partilhado a partir de `/en`. É por isso que o
 * `buildMetadata` aponta para `/og/default.png?lang=<locale>`.
 */
export async function GET(request: Request) {
  const lang = new URL(request.url).searchParams.get("lang");
  const locale = resolveLocale(lang);
  const texto = (locale === "en" ? en : pt).site;

  // A frase do site (cliente, 8 nov 2026): "Compre e venda imóveis" numa
  // linha, e depois "sem comissões" na cor primária e o resto, a quebrar
  // sozinho. O Satori não mistura cores num só bloco de texto: o destaque e o
  // resto vão palavra a palavra, numa linha flexível que quebra como texto.
  const { lead, accent, tail } = texto.ogCard;
  const titulo = `${lead} ${accent}${tail}`;
  const destaque = accent.split(" ");
  // Em português o resto começa por ", " (a vírgula cola-se ao destaque); em
  // inglês, por um espaço.
  const pontuacao = tail.startsWith(" ") ? "" : tail.trimStart().split(" ")[0]!;
  const resto = tail
    .trim()
    .split(" ")
    .slice(pontuacao ? 1 : 0);
  const endereco = "upropertymarket.pt";
  const [fundo, logo, modo, titular, selo, rodape] = await Promise.all([
    dataUrl(new URL("/site/og-fundo.jpg", request.url), "image/jpeg"),
    dataUrl(new URL("/brand/logo-dark.svg", request.url), "image/svg+xml"),
    getLaunchMode(),
    googleFont(TITULOS, 700, titulo),
    googleFont("Manrope", 600, texto.ogCard.preBadge),
    googleFont("Manrope", 500, endereco),
  ]);
  const fonts = [titular, selo, rodape].filter((font): font is Font => font !== null);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: "#050a16",
      }}
    >
      {fundo ? (
        // eslint-disable-next-line @next/next/no-img-element -- Satori só desenha <img>
        <img
          src={fundo}
          alt=""
          width={WIDTH}
          height={HEIGHT}
          style={{ position: "absolute", top: 0, left: 0, width: WIDTH, height: HEIGHT }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: WIDTH,
          height: HEIGHT,
          display: "flex",
          backgroundImage:
            "linear-gradient(90deg, rgba(5,10,22,0.94) 0%, rgba(5,10,22,0.88) 42%, rgba(5,10,22,0.45) 68%, rgba(5,10,22,0.08) 100%)",
        }}
      />

      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
        }}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- Satori só desenha <img>
          <img src={logo} alt="" width={262} height={84} />
        ) : (
          <span style={{ fontSize: 34, fontWeight: 700, color: "#f8fafc" }}>UProperty Market</span>
        )}

        <div style={{ display: "flex", flexDirection: "column", maxWidth: 680 }}>
          {modo === "pre" ? (
            <div style={{ display: "flex", marginBottom: 28 }}>
              <span
                style={{
                  fontFamily: "Manrope",
                  fontSize: 22,
                  fontWeight: 600,
                  color: "#ffffff",
                  background: "#ea580c",
                  borderRadius: 999,
                  padding: "10px 22px",
                }}
              >
                {texto.ogCard.preBadge}
              </span>
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              fontFamily: TITULOS,
              fontSize: 58,
              fontWeight: 700,
              color: TEXTO,
              lineHeight: 1.12,
              letterSpacing: "-0.02em",
            }}
          >
            <span style={{ width: "100%" }}>{lead}</span>
            {destaque.map((palavra, i) => (
              <span key={`d${i}`} style={{ display: "flex", marginRight: "0.25em" }}>
                <span style={{ color: ACCENT_ON_DARK }}>{palavra}</span>
                {i === destaque.length - 1 && pontuacao ? <span>{pontuacao}</span> : null}
              </span>
            ))}
            {resto.map((palavra, i) => (
              <span key={`r${i}`} style={{ marginRight: "0.25em" }}>
                {palavra}
              </span>
            ))}
          </div>
          <span
            style={{
              fontFamily: "Manrope",
              fontSize: 26,
              fontWeight: 500,
              color: "#cbd5e1",
              marginTop: 32,
            }}
          >
            {endereco}
          </span>
        </div>
      </div>
    </div>,
    { width: WIDTH, height: HEIGHT, fonts },
  );
}
