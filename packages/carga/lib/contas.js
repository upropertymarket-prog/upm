/**
 * Contas de teste e sessões, para o k6 (A4)
 * =========================================================================
 * Criadas no `setup()` pela API de administração e apagadas no `teardown()`.
 * Domínio `.test`: nunca recebem e-mail, e o `signUp` público nem as aceita.
 *
 * **Uma entrada por conta, no setup.** O Supabase Auth limita as entradas por
 * IP; 50 utilizadores virtuais a entrar do mesmo computador mediam esse
 * limite, não a app. Os tokens duram uma hora, e um perfil dura menos.
 */
import encoding from "k6/encoding";
import http from "k6/http";

import { cabecalhos, cabecalhosDeServico, env, hostDe } from "./ambiente.js";

const SENHA = "Carga-Teste-UPM-2026!";
const PLANO = { owner: "premium-owner", buyer: "premium-buyer" };

function falhou(o_que, r) {
  throw new Error(`${o_que}: HTTP ${r.status} ${String(r.body).slice(0, 200)}`);
}

/** Cria `n` contas do papel pedido, com plano ativo, e devolve-as já com sessão. */
export function criarContas(papel, n, etiqueta) {
  const { body: planos } = http.get(
    `${env.supabase}/rest/v1/plans?select=id&slug=eq.${PLANO[papel]}`,
    { headers: cabecalhosDeServico() },
  );
  const plano = JSON.parse(planos)[0];
  if (!plano) throw new Error(`Plano ${PLANO[papel]} não existe no alvo`);

  const contas = [];
  for (let i = 0; i < n; i += 1) {
    const email = `carga-${etiqueta}-${papel}-${Date.now()}-${i}@upropertymarket.test`;
    const criada = http.post(
      `${env.supabase}/auth/v1/admin/users`,
      JSON.stringify({
        email,
        password: SENHA,
        email_confirm: true,
        user_metadata: { role: papel, full_name: `Carga ${papel} ${i}` },
      }),
      { headers: cabecalhosDeServico() },
    );
    if (criada.status !== 200) falhou(`criar ${email}`, criada);
    const id = JSON.parse(criada.body).id;

    const sub = http.post(
      `${env.supabase}/rest/v1/subscriptions`,
      JSON.stringify({ profile_id: id, plan_id: plano.id, status: "active" }),
      { headers: cabecalhosDeServico() },
    );
    if (sub.status >= 300) falhou(`plano de ${email}`, sub);

    contas.push({ id, email, papel, sessao: entrar(email) });
  }
  return contas;
}

function entrar(email) {
  const r = http.post(
    `${env.supabase}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email, password: SENHA }),
    { headers: cabecalhos() },
  );
  if (r.status !== 200) falhou(`entrar ${email}`, r);
  return JSON.parse(r.body);
}

/**
 * Apaga as contas (os imóveis delas vão primeiro, como nos E2E). Uma falha
 * diz-se: foi uma limpeza calada que deixou 10 anúncios de teste publicados
 * no site (encontrado pelo fumo deste cenário, a 3 nov). Os anúncios daqui
 * nunca passam pela moderação, por isso não há histórico a prendê-los.
 */
export function apagarContas(contas) {
  for (const c of contas || []) {
    const imoveis = http.del(`${env.supabase}/rest/v1/properties?owner_id=eq.${c.id}`, null, {
      headers: cabecalhosDeServico(),
    });
    const conta = http.del(`${env.supabase}/auth/v1/admin/users/${c.id}`, null, {
      headers: cabecalhosDeServico(),
    });
    if (imoveis.status >= 300 || conta.status >= 300) {
      console.error(
        `[carga] a conta ${c.email} não saiu: imóveis HTTP ${imoveis.status}, conta HTTP ${conta.status}`,
      );
    }
  }
}

/**
 * O cookie de sessão tal como o `@supabase/ssr` (0.12) o escreve:
 * `sb-<projeto>-auth-token` = `base64-` + JSON da sessão em base64url, partido
 * em pedaços de 3180 caracteres (`.0`, `.1`, …) quando não cabe num só.
 */
export function cookieDeSessao(sessao) {
  const projeto = hostDe(env.supabase).split(".")[0];
  const nome = `sb-${projeto}-auth-token`;
  const valor = `base64-${encoding.b64encode(JSON.stringify(sessao), "rawurl")}`;
  const TAMANHO = 3180;
  if (valor.length <= TAMANHO) return `${nome}=${valor}`;
  const partes = [];
  for (let i = 0; i * TAMANHO < valor.length; i += 1) {
    partes.push(`${nome}.${i}=${valor.slice(i * TAMANHO, (i + 1) * TAMANHO)}`);
  }
  return partes.join("; ");
}
