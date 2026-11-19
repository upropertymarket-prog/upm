# Pendente para o doc 12 (Segurança) — bloqueador da B1

> Por aplicar no doc 12, secção dos bloqueadores (B1 · allowlist de IP do `interno`).
> Registado a 19 nov 2026. As ferramentas de docs do Tempo não estavam disponíveis nesta sessão.
> **Nada disto vai para produção antes da B1.** Não há migração nem alteração de código: o SQL
> abaixo é desenho e fica só aqui, fora de `supabase/migrations`, para nenhum `db push` o apanhar.

---

## B1.a — Sem sessão, a allowlist não se aplica

**Estado:** aberto · **Bloqueia:** ligar a B1 (popular `feature_flags.interno_ip_allowlist`)
**Encontrado:** 18 nov 2026, ao rever a policy `feature_flags_select`

### Problema

`apps/interno/src/middleware.ts` lê a flag `interno_ip_allowlist` com o cliente do pedido,
**antes** do `supabase.auth.getUser()` e dos `publicPaths`:

```ts
const { data: allowlistFlag } = await supabase
  .from("feature_flags").select("value").eq("key", "interno_ip_allowlist").maybeSingle();
const allowlist = Array.isArray(allowlistFlag?.value) ? allowlistFlag.value : [];
…
if (allowlist.length > 0 && (!clientIp || !isIpAllowed(clientIp, allowlist))) → 403
```

A policy de `feature_flags` é `key = 'launch_mode' or public.is_staff()`
(`20261002130300_admin_settings.sql`; confirmada em `pg_policies` a 18 nov). Um pedido
**sem sessão**, ou de uma conta que não é staff, não vê a linha. Recebe uma lista vazia,
`allowlist.length > 0` dá falso e a verificação de IP é saltada.

### Consequência

- **Hoje não tem efeito:** a lista está vazia, e lista vazia quer dizer allowlist desligada.
- **Quando a B1 a popular,** o portão de IP não protege `/entrar`, `/recuperar`,
  `/auth/confirmar` nem nenhum caminho antes da autenticação. Passa exatamente quem o
  controlo devia travar: o estranho antes de entrar. A allowlist só se aplicaria a staff
  já autenticado, o contrário do que se pretende.
- É mais um caso de "escrito e desligado": o código parece certo numa revisão e o teste
  `admin-rls.test.ts` ("feature_flags só expõe launch_mode") até prova a policy que causa o buraco.

### O que **não** é a correção

Abrir `interno_ip_allowlist` ao anon na policy. O portão passava a funcionar, mas qualquer
pessoa lia as redes da empresa (`GET /rest/v1/feature_flags?key=eq.interno_ip_allowlist`
com a anon key pública). Isso é um mapa de onde atacar.

### Correção desenhada

Uma função `security definer` lê a lista por dentro e devolve **só o veredito**. O anon
nunca vê as redes, e o portão aplica-se antes do login. A policy de `feature_flags` fica
como está.

**1. Função (migração da B1, não agora):**

```sql
create or replace function public.ip_interno_permitido(p_ip text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_lista   jsonb;
  v_ip      inet;
  v_entrada text;
  v_rede    inet;
begin
  select value into v_lista from public.feature_flags where key = 'interno_ip_allowlist';

  -- Mesma semântica de `isIpAllowed` (packages/config/security.ts):
  -- lista ausente, que não seja array, ou vazia = allowlist desligada = permite tudo.
  if v_lista is null or jsonb_typeof(v_lista) <> 'array' or jsonb_array_length(v_lista) = 0 then
    return true;
  end if;

  -- Falha fechada: um IP ausente ou que não se interpreta não passa.
  begin
    v_ip := p_ip::inet;
  exception when others then
    return false;
  end;
  if v_ip is null then
    return false;
  end if;

  -- IPv4 mapeado em IPv6 (::ffff:a.b.c.d) conta como IPv4, como no TS.
  if family(v_ip) = 6 and v_ip <<= '::ffff:0:0/96'::inet then
    v_ip := substr(host(v_ip), 8)::inet;
  end if;

  for v_entrada in select jsonb_array_elements_text(v_lista) loop
    -- Nunca `::cidr` na entrada crua: recusa `10.0.0.1/8`, que o TS aceita e a
    -- gravação deixa passar. Match em espaço inet: `network()` limpa os bits
    -- fora da máscara (10.0.0.1/8 → 10.0.0.0/8), como o deslocamento do TS.
    -- Entrada que nem `::inet` aceita é ignorada, como hoje (o TS descarta e avisa).
    begin
      v_rede := network(v_entrada::inet);
    exception when others then
      continue;
    end;
    -- `<<=` entre famílias diferentes dá falso, como `rede.bits !== endereco.bits`.
    if v_ip <<= v_rede then
      return true;
    end if;
  end loop;

  return false;
end;
$$;

revoke all on function public.ip_interno_permitido(text) from public;
grant execute on function public.ip_interno_permitido(text) to anon, authenticated;
```

Notas sobre a função:
- O parâmetro é `text`, não `inet`. Com `inet`, um cabeçalho malformado rebentava no
  PostgREST com 400 antes de entrar na função. Assim dá `false`, que é falhar fechado.
- Bits fora da máscara: ver **"Resolvido: `10.0.0.1/8` e o `::cidr`"** abaixo. O rascunho já
  usa a opção 1.
- Uma lista **só com entradas inválidas** dá `false` para toda a gente. O TS atual faz o mesmo
  (`length > 0`, nenhuma casa). Fica registado como comportamento conhecido: tranca o interno.
- O `execute` a `anon, authenticated` é o único acesso de que precisam. Desde a A15 também é
  preciso acrescentar `ip_interno_permitido` a `ANON_PERMITIDAS` (`superficie-anon.test.ts`),
  com a razão escrita.
- Devolve um oráculo "este IP passa?" a qualquer um. É aceitável: é a mesma informação que o
  403 do middleware já dá, e não revela as redes.

**2. Middleware (`apps/interno/src/middleware.ts`, na B1):**

```ts
// Allowlist de IP/VPN (07 §6) — antes de tudo, mesmo do login. A lista nunca
// sai da base: a função devolve só o veredito, e o anon consegue pedi-lo.
const clientIp = clientIpFrom(request.headers);
const { data: permitido, error } = await supabase.rpc("ip_interno_permitido", {
  p_ip: clientIp ?? "",
});
if (error || permitido !== true) {
  return new NextResponse("Acesso não permitido a partir desta rede.", { status: 403 });
}
```

- Sai a leitura de `feature_flags` e o `isIpAllowed` do middleware. O `isIpAllowed` continua
  útil para os testes de paridade TS ↔ SQL.
- **Erro da RPC = 403** (falha fechada). Sem base de dados o interno também não funciona,
  por isso não se perde nada.
- O aviso de CIDRs inválidos (`console.error(... invalidos)`) deixa de poder estar no
  middleware, porque o anon não lê a lista. Passa para o **momento de escrita**: a ação de
  Definições (`admin/definicoes/actions.ts`) recusa guardar uma lista com entradas inválidas
  e diz quais. É melhor do que avisar depois, num log.
- Custo: uma ida à base por pedido, a mesma que já existe (~100 ms; ver
  "Desempenho: a rede, não a base"). Se pesar, cache curta em memória como em `launch-mode-edge.ts`.

**3. Policy de `feature_flags`:** **não muda.** Continua `key = 'launch_mode' or public.is_staff()`.

### Resolvido: `10.0.0.1/8` e o `::cidr` (19 nov 2026)

Estava em aberto: o `::cidr` recusa CIDRs com bits fora da máscara, e não se sabia se o TS os
aceitava. Confirmado no código:

- **O TS aceita.** `lerCidr` (`packages/config/security.ts`) não verifica os bits do host contra
  o prefixo, e `isIpAllowed` compara `valor >> deslocamento` dos dois lados. Na prática mascara,
  por isso `10.0.0.1/8` funciona hoje como `10.0.0.0/8`.
- **A gravação deixa passar.** A RPC de escrita das flags (`20261002130300_admin_settings.sql`,
  linha 71) valida cada entrada com `::inet`, **não** com `::cidr`. Como `'10.0.0.1/8'::inet` é
  válido, um admin **consegue** gravar hoje uma entrada com bits fora da máscara.
- **O risco na B1.** Se a função fizer `::cidr` na entrada crua, `'10.0.0.1/8'::cidr` lança
  exceção. Há dois cenários, e nenhum serve:
  - **Sem bloco `exception`:** a RPC dá erro e, pela regra "erro da RPC = 403", fica tudo
    trancado: 403 para toda a gente em `/entrar`, staff incluído. Uma só entrada má tranca a
    equipa cá fora.
  - **Com `begin … exception … continue`** (era assim no primeiro rascunho desta nota): a
    entrada é ignorada em silêncio. O SQL passa a divergir do TS sem aviso: quem está em
    `10.0.0.5` entra pelo TS e é recusado pelo SQL. Se for a única entrada válida, o resultado
    volta a ser lockout total.

**Alinhamento (escolher um na B1, não implementar agora):**

1. **Nunca fazer `::cidr` na entrada crua: o match faz-se em espaço inet.**
   `if p_ip::inet <<= network(entrada::inet) then …`. `network('10.0.0.1/8'::inet)` dá
   `10.0.0.0/8`, e `<<=` testa a contenção, igual ao TS. Não exige migrar dados.
2. **Canonizar na gravação.** A RPC de escrita guarda já a forma de rede (`network(e::inet)`,
   segura para `::cidr`), e migram-se as entradas existentes. Assim o SQL de leitura pode usar
   `::cidr`, e o admin vê no ecrã a rede que de facto está a contar (`10.0.0.0/8`), não a que
   escreveu.

O rascunho da função acima já está escrito com a **opção 1**, porque funciona com ou sem a
opção 2: entradas já canónicas passam por `network()` sem mudar. As duas não se excluem. A 1
torna a leitura robusta e a 2 torna a lista legível para quem a gere.

### Testes a escrever com a correção (B1)

- Anon sem sessão, IP fora da lista → 403 em `/entrar` (é o teste que falta hoje e que teria
  apanhado isto; vê-lo falhar antes de corrigir).
- Anon, IP dentro da lista → passa para o login.
- Anon continua sem conseguir ler `interno_ip_allowlist` (o teste atual de `admin-rls` mantém-se).
- Paridade TS ↔ SQL: a mesma tabela de casos (IPv4, IPv6, mapeado, prefixo 0, CIDR inválido,
  famílias cruzadas, lista vazia) contra `isIpAllowed` e contra `ip_interno_permitido`.
- **Bits fora da máscara**, caso obrigatório da tabela TS ↔ SQL. Com a lista `["10.0.0.1/8"]`:
  (a) `10.0.0.5` é **permitido** dos dois lados; (b) a função **não rebenta**: devolve `true`,
  não dá erro, e por isso não cai no 403 de falha fechada. Acrescentar o par de controlo:
  `11.0.0.5` é recusado dos dois lados.

### Dependências que já estavam na B1 e continuam

- Proxy obrigatório à frente que reescreva os cabeçalhos de IP. Sem ele o `x-forwarded-for` é
  falsificável e qualquer allowlist é decorativa. Sem Cloudflare à frente, não confiar em
  `cf-connecting-ip` (ver "Pré-lançamento antes da empresa").

### Regra

**Nada disto vai para produção antes da B1.** Fica como dívida documentada: nem migração em
`supabase/migrations`, nem mudança ao middleware ou à policy, até a B1 ser trabalhada e a
allowlist ir ser populada. Ligar a allowlist **sem** esta correção é pior do que não a ligar,
porque dá a impressão de proteção sem a dar.
