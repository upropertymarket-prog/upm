import { ImageResponse } from "next/og";

/**
 * A imagem Open Graph por omissão — `/og/default.png` (P2-06 · fecha D63)
 * =========================================================================
 * ## O que estava partido
 *
 * `buildMetadata` cai para `DEFAULT_OG_IMAGE` sempre que uma rota não declara
 * `ogImage`, e **nenhuma declara**. Esse caminho apontava para
 * `/og/default.jpg`, um ficheiro que nunca existiu no repositório — é a D63.
 * O efeito prático: cada vez que alguém partilhava uma página do site no
 * WhatsApp, no LinkedIn ou no Slack, o cartão saía sem imagem. Não é um
 * detalhe de SEO; é a primeira impressão da marca em todo o lado onde um link
 * é colado.
 *
 * ## Porque é gerada e não um ficheiro
 *
 * O plano pede "imagens em `public/og`", e as imagens **por rota** continuam a
 * ser ficheiros versionados — é o que a D62 assume e o que o campo de texto do
 * `/admin/seo` edita. O que muda é só a de omissão, e por uma razão concreta:
 * o ícone da marca ainda não foi entregue. Só existe o wordmark, e a regra do
 * projeto é não derivar um ícone a partir dele. Um cartão feito de tipografia e
 * das cores da marca não inventa símbolo nenhum — usa o que existe.
 *
 * Gerar tem ainda duas vantagens que valem por si: o cartão acompanha os tokens
 * (o laranja aqui é o `--accent` do tema claro, `#ea580c`) e não há um binário
 * no git a envelhecer em silêncio.
 *
 * **É uma rede de segurança, não a imagem da marca.** Fica até existirem as
 * imagens por rota desenhadas; quando existirem, cada `seo.ts` declara o seu
 * `ogImage` e isto deixa de ser alcançado — sem precisar de ser apagado.
 *
 * ## Notas de implementação
 *
 * `ImageResponse` desenha com um subconjunto de flexbox e **exige** `display`
 * explícito em qualquer elemento com mais de um filho; não há `gap` em alguns
 * casos, daí as margens à mão. Sem `fonts` declaradas usa a fonte de sistema do
 * runtime — deliberado: carregar a Bricolage daqui obrigava a ler o ficheiro do
 * `@fontsource` em cada pedido, e isto é a imagem de recurso.
 *
 * `revalidate` de um dia: o cartão é estático na prática, e o Next serve-o de
 * cache em vez de o voltar a desenhar a cada robô que passa.
 */

export const revalidate = 86400;

const WIDTH = 1200;
const HEIGHT = 630;

export async function GET() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#050a16",
        padding: 80,
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: 999,
            background: "#ea580c",
            marginRight: 16,
          }}
        />
        <span
          style={{
            fontSize: 30,
            fontWeight: 700,
            color: "#e6edf6",
            letterSpacing: "-0.01em",
          }}
        >
          UProperty Market
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <span
          style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#ea580c",
            marginBottom: 24,
          }}
        >
          Your property your choice
        </span>
        <span
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: "#e6edf6",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}
        >
          Propriedades sem comissões,
        </span>
        <span
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: "#e6edf6",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}
        >
          nem contactos indesejados.
        </span>
      </div>

      <span style={{ fontSize: 26, color: "#8ba0bd" }}>upropertymarket.pt</span>
    </div>,
    { width: WIDTH, height: HEIGHT },
  );
}
