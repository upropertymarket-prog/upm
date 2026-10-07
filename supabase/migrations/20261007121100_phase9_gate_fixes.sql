-- UProperty Market — Fase 9, correções do portão
--
-- `pnpm gate:db` correu pela primeira vez **depois** de as migrações da fase
-- estarem aplicadas, a 7 out 2026, e apanhou dois erros que nenhum teste tinha
-- apanhado — porque os testes de RLS continuam a saltar por falta de
-- credenciais (D13), e porque nenhum dos dois é um erro de sintaxe: as duas
-- funções criam-se sem reclamar e só rebentam quando alguém as chama.
--
-- As migrações originais NÃO são reescritas: já estão aplicadas, e 07 §20.7
-- proíbe-o. Corrige-se aqui.
--
-- ---------------------------------------------------------------------------
-- 1. `hash_identity` chamava um `hmac` que não existe
-- ---------------------------------------------------------------------------
--
-- Erro do lint: `function hmac(text, bytea, unknown) does not exist`.
--
-- O pgcrypto só tem duas assinaturas de `hmac`:
--
--     hmac(data text,  key text,  type text) returns bytea
--     hmac(data bytea, key bytea, type text) returns bytea
--
-- e a chamada passava **texto como dados e bytea como chave** — que não
-- corresponde a nenhuma das duas. `identity_secrets.secret` é `bytea`, logo o
-- que tem de mudar é o lado dos dados: `convert_to(..., 'UTF8')`.
--
-- **Isto não era um defeito cosmético.** `hash_identity` é o que torna
-- `person_identities` possível (P9-07): sem ela não há hash de NIF, de telefone
-- nem de e-mail, logo não há unicidade de conta nem elegibilidade de registo.
-- A função ter-se-ia mantido partida até ao primeiro registo real.
--
-- O comentário original dizia que o pgcrypto "vive em `public`"; o que o lint
-- mostra é que o problema nunca foi o schema — era a assinatura.

create or replace function public.hash_identity(p_kind text, p_value text)
returns text
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_secret bytea;
begin
  if p_value is null or btrim(p_value) = '' then
    return null;
  end if;

  select secret into v_secret
  from public.identity_secrets
  where key = 'person_identity';

  if v_secret is null then
    raise exception 'Segredo de identidade em falta' using errcode = '55000';
  end if;

  -- `convert_to` leva o texto a bytea para casar com `hmac(bytea, bytea, text)`,
  -- que é a única sobrecarga compatível com uma chave `bytea`. O `kind` entra no
  -- texto assinado para que o mesmo dígito a fazer de NIF e de telefone não dê o
  -- mesmo hash.
  return encode(
    hmac(
      convert_to(p_kind || ':' || lower(btrim(p_value)), 'UTF8'),
      v_secret,
      'sha256'
    ),
    'hex'
  );
end;
$$;

revoke all on function public.hash_identity(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. `export_own_account_data` era `stable` e escrevia no `audit_log`
-- ---------------------------------------------------------------------------
--
-- Erro do lint: `INSERT is not allowed in a non volatile function`.
--
-- A função foi declarada `stable` — o que diz ao Postgres que não altera a base
-- de dados — e no fim insere a linha de auditoria do pedido de exportação. O
-- Postgres recusa em execução, com `0A000`.
--
-- O registo da exportação é deliberado e fica (08 §6.7 quer rasto de quem pediu
-- os seus dados). O que estava errado era a volatilidade.
--
-- `alter function` em vez de `create or replace`: muda só o que está errado, e
-- não obriga a copiar para aqui um corpo de sessenta linhas que ninguém reviu
-- de novo — copiá-lo seria convidar uma divergência silenciosa entre as duas
-- cópias.

alter function public.export_own_account_data() volatile;
