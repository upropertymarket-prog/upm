-- UProperty Market — Fase 7 (Faturação), P7-04, parte 2/2
--
-- "Guardar na Cloud" e "Exportar" (04 §8.3, 03 F8). A cópia do PDF entra na
-- Cloud pelo caminho normal — `cloud_register_upload` com `source = 'invoice'`,
-- que já verifica a quota antes de o ficheiro contar (07 §19.8 #1). O que
-- falta é ligar as duas coisas e registar o acesso.

/**
 * Liga a fatura ao ficheiro que acabou de nascer na Cloud e deixa a linha no
 * registo de acessos. Guardar a mesma fatura duas vezes não cria um segundo
 * ficheiro: se já lá estiver uma cópia, a função recusa e a Server Action
 * apaga o objeto que tinha acabado de carregar.
 */
create or replace function public.invoice_saved_to_cloud(p_invoice_id uuid, p_file_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_existing uuid;
begin
  if v_me is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;

  select saved_file_id into v_existing
  from public.invoices
  where id = p_invoice_id and profile_id = v_me;

  if not found then
    raise exception 'Fatura inexistente' using errcode = '42501';
  end if;

  if v_existing is not null then
    raise exception 'Esta fatura já está guardada na Cloud' using errcode = '23505';
  end if;

  if not exists (
    select 1 from public.files
    where id = p_file_id and owner_id = v_me and source = 'invoice'
  ) then
    raise exception 'Ficheiro inválido' using errcode = '42501';
  end if;

  update public.invoices set saved_file_id = p_file_id where id = p_invoice_id;

  insert into public.document_access_log (subject_type, subject_id, action, actor_profile_id)
  values ('invoice', p_invoice_id, 'download', v_me);
end;
$$;

/**
 * Registo de um acesso à fatura, verificando que é de quem a pede — ao
 * contrário de `log_document_access`, que é genérica e aceita qualquer
 * assunto (serve as partilhas anónimas, onde não há sessão para verificar).
 */
create or replace function public.log_invoice_access(
  p_invoice_id uuid,
  p_action public.document_action default 'download'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.invoices where id = p_invoice_id and profile_id = v_me
  ) then
    raise exception 'Fatura inexistente' using errcode = '42501';
  end if;

  insert into public.document_access_log (subject_type, subject_id, action, actor_profile_id)
  values ('invoice', p_invoice_id, p_action, v_me);
end;
$$;
