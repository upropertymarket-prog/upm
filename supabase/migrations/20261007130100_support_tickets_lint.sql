-- ---------------------------------------------------------------------------
-- Avisos do portão de P10-01, e o aviso herdado da Fase 9
-- ===========================================================================
-- `pnpm gate:db` correu DEPOIS do `db push` de `20261007130000` — que é a
-- única altura em que serve de alguma coisa (doc 10 §1.7) — e devolveu zero
-- erros e oito avisos. Seis eram meus. Uma migração aplicada nunca se reescreve
-- (07 §20.7), por isso saem aqui, com `create or replace`.
--
-- 1. `suggest_ticket_severity` devolvia literais de texto onde a assinatura
--    declara `ticket_severity`, quatro vezes (SQLSTATE 42804). O Postgres fazia
--    o cast implícito e a função respondia certo — mas um `return 'criticl'`
--    com erro de escrita passaria a compilação e rebentaria **em execução**, no
--    primeiro bug crítico, que é o pior momento possível. Com o cast explícito
--    o erro aparece ao criar a função.
--
-- 2. `generate_ticket_ref` declarava `i integer` e o `for i in 1..8` cria a sua
--    própria variável de ciclo — a declarada ficava a sombrear sem uso.
--    Inofensivo, e exactamente o tipo de ruído que faz com que um aviso real
--    passe despercebido no meio dos outros.
--
-- 3. **Os dois avisos herdados de `is_valid_pt_nif`** (P9-01) são a mesma
--    coisa, e saem ao mesmo tempo. Ficaram registados como "dois avisos" no
--    fecho da Fase 9; dois avisos permanentes num portão são dois avisos que
--    ninguém volta a ler. A função é recriada **com a lógica intacta** — os
--    prefixos 1/2/3/45 confirmados pelo cliente (D54), o módulo 11 e a
--    verificação final são os mesmos. Só a declaração a mais desaparece.
--
-- Depois desta migração, `gate:db` passa com **zero erros e zero avisos**.
-- ---------------------------------------------------------------------------

create or replace function public.suggest_ticket_severity(
  p_route text,
  p_affected_users integer default 1
)
returns public.ticket_severity
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_route text := coalesce(p_route, '');
  v_threshold integer;
begin
  -- Onde se cobra. Crítico à primeira pessoa, sem depender de volume.
  if v_route like '/plano%'
     or v_route like '/api/stripe%'
     or v_route like '/criar-conta%'
  then
    return 'critical'::public.ticket_severity;
  end if;

  -- Onde se tratam dados pessoais: a Zona de perigo (P9-06) e as partilhas.
  if v_route like '/definicoes%' or v_route like '/partilha%' then
    return 'critical'::public.ticket_severity;
  end if;

  select nullif(value::text, 'null')::integer
  into v_threshold
  from public.app_settings
  where key = 'ticket_critical_affected_users';

  if coalesce(p_affected_users, 1) >= coalesce(v_threshold, 5) then
    return 'critical'::public.ticket_severity;
  end if;

  return 'medium'::public.ticket_severity;
end;
$$;

comment on function public.suggest_ticket_severity(text, integer) is
  'Gravidade sugerida (04 §2.7 #4). Pagamentos e dados pessoais são críticos à '
  'primeira pessoa; o limiar de volume vive em app_settings '
  '(ticket_critical_affected_users = 5, decisão do cliente de 7 out 2026).';

create or replace function public.generate_ticket_ref()
returns text
language plpgsql
volatile
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_ref text := '';
begin
  -- Sem `declare i`: o `for` declara a sua própria variável de ciclo.
  for position in 1..8 loop
    if position = 5 then
      v_ref := v_ref || '-';
    end if;
    v_ref := v_ref
      || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
  end loop;
  return v_ref;
end;
$$;

comment on function public.generate_ticket_ref() is
  'Referência XXXX-XXXX de um ticket, de um alfabeto sem 0/O/1/I/L: vai ser '
  'lida ao telefone e escrita à mão (05 §1.8).';

create or replace function public.is_valid_pt_nif(p_value text)
returns boolean
language plpgsql
immutable
as $$
declare
  v_digits text := regexp_replace(coalesce(p_value, ''), '\D', '', 'g');
  v_sum integer := 0;
  v_check integer;
begin
  if length(v_digits) <> 9 then
    return false;
  end if;

  if not (
    left(v_digits, 1) in ('1', '2', '3')
    or left(v_digits, 2) = '45'
  ) then
    return false;
  end if;

  -- Sem `declare i`, pela mesma razão. A aritmética é a de `20261007120000`.
  for position in 1..8 loop
    v_sum := v_sum + (substr(v_digits, position, 1))::integer * (10 - position);
  end loop;

  v_check := 11 - (v_sum % 11);
  if v_check >= 10 then
    v_check := 0;
  end if;

  return v_check = (substr(v_digits, 9, 1))::integer;
end;
$$;

comment on function public.is_valid_pt_nif(text) is
  'NIF português de PESSOA SINGULAR: 9 dígitos, módulo 11, prefixos 1/2/3/45 (P9-01).';
