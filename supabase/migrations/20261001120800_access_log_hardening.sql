-- UProperty Market — Fase 7, correção de segurança a uma função da Fase 6
--
-- Encontrado ao escrever P7-04: `log_document_access` é `security definer`,
-- está concedida a `anon` e a `authenticated`, e aceitava QUALQUER
-- `subject_id` e `actor` sem verificar nada. Com ela, uma sessão qualquer
-- podia escrever no registo de acessos de documentos de outra pessoa —
-- inventar um "transferiu o contrato às 3h da manhã" que ficaria lá para
-- sempre, porque a tabela é append-only de propósito (07 §13.3).
--
-- Isto importa mais do que um erro de permissões normal: 08 §6.9 trata o
-- registo de acessos como PROVA, e uma prova que qualquer um pode escrever
-- não é prova nenhuma.
--
-- A assinatura fica igual — os dois sítios que a chamam (transferir um
-- ficheiro da Cloud e abrir uma ligação partilhada) não mudam. O que muda é
-- que agora prova-se o direito antes de escrever:
--
--   * com `p_share_id`: a partilha tem de existir, apontar para este objeto,
--     não estar revogada nem expirada. É o caminho das ligações anónimas, que
--     não têm sessão para verificar;
--   * com sessão: o objeto tem de ser do próprio, ou estar partilhado com ele.
--
-- Registado como defeito da Fase 6 encontrado e pago na Fase 7.

create or replace function public.log_document_access(
  p_subject_type public.document_subject,
  p_subject_id uuid,
  p_action public.document_action,
  p_version_id uuid default null,
  p_share_id uuid default null,
  p_ip inet default null,
  p_user_agent text default null,
  p_bytes_sent bigint default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_ok boolean := false;
  v_id bigint;
begin
  if p_share_id is not null then
    -- Acesso por ligação. Vale para ficheiro e para contrato; em qualquer dos
    -- casos a partilha tem de ser deste objeto e estar viva.
    v_ok :=
      exists (
        select 1 from public.file_shares s
        where s.id = p_share_id
          and s.file_id = p_subject_id
          and p_subject_type = 'file'
          and s.revoked_at is null
          and (s.expires_at is null or s.expires_at > now())
      )
      or exists (
        select 1 from public.contract_shares s
        where s.id = p_share_id
          and s.contract_id = p_subject_id
          and p_subject_type = 'contract'
          and s.revoked_at is null
          and (s.expires_at is null or s.expires_at > now())
      );

  elsif v_me is not null then
    v_ok := case p_subject_type
      when 'file' then exists (
        select 1 from public.files f
        where f.id = p_subject_id
          and (
            f.owner_id = v_me
            or exists (
              select 1 from public.file_shares s
              where s.file_id = f.id
                and s.shared_with = v_me
                and s.revoked_at is null
                and (s.expires_at is null or s.expires_at > now())
            )
          )
      )
      when 'contract' then exists (
        select 1 from public.contracts c
        where c.id = p_subject_id
          and (
            c.owner_id = v_me
            or c.counterparty_profile_id = v_me
            or exists (
              select 1 from public.contract_shares s
              where s.contract_id = c.id
                and s.shared_with_profile_id = v_me
                and s.revoked_at is null
                and (s.expires_at is null or s.expires_at > now())
            )
          )
      )
      when 'property_document' then exists (
        select 1
        from public.property_documents d
        join public.properties p on p.id = d.property_id
        where d.id = p_subject_id and (p.owner_id = v_me or public.is_staff())
      )
      when 'invoice' then exists (
        select 1 from public.invoices i where i.id = p_subject_id and i.profile_id = v_me
      )
      -- Os modelos são do Admin; quem os lê fora disso não gera registo.
      when 'contract_template' then public.is_staff()
      else false
    end;
  end if;

  if not v_ok then
    raise exception 'Sem acesso a este documento' using errcode = '42501';
  end if;

  insert into public.document_access_log (
    subject_type, subject_id, action, version_id, share_id,
    actor_profile_id, ip, user_agent, bytes_sent
  ) values (
    p_subject_type, p_subject_id, p_action, p_version_id, p_share_id,
    v_me, p_ip, p_user_agent, p_bytes_sent
  )
  returning id into v_id;

  return v_id;
end;
$$;
