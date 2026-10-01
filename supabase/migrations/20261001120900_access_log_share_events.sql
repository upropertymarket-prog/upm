-- UProperty Market — Fase 7, ajuste à correção anterior
--
-- `20261001120800` passou a exigir uma partilha VIVA sempre que vinha um
-- `p_share_id`. Só que `revoke_file_share` regista `share_revoked` logo a
-- seguir a revogar — a partilha já não está viva nesse instante, e o registo
-- da revogação passou a falhar. Apanhado pelo teste "revogar tira o acesso
-- imediatamente", que é exatamente para isto que lá está.
--
-- A ordem certa de verificação é a inversa: primeiro o direito de QUEM está
-- na sessão (o dono revoga a partilha dele), e a partilha viva só como
-- alternativa, para o caminho anónimo das ligações, que não tem sessão
-- nenhuma para verificar.

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
  -- 1. Quem tem sessão: o objeto é dele, foi-lhe partilhado, ou é staff.
  if v_me is not null then
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
      when 'contract_template' then public.is_staff()
      else false
    end;
  end if;

  -- 2. Sem sessão (ou sem direito próprio): vale uma partilha viva deste
  --    objeto. É o caminho das ligações anónimas de 07 §19.14.
  if not v_ok and p_share_id is not null then
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
