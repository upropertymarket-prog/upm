-- ---------------------------------------------------------------------------
-- Apagar e repor na Cloud interna (P10-10)
--
-- `cloud_delete_file()` (Fase 6) exige `owner_id = auth.uid()`, e está certa
-- para a Cloud pessoal: lá, o dono é quem lá mexe. Na Cloud **interna** essa
-- regra produz um resultado que ninguém quer — o Suporte não apaga um ficheiro
-- que o Marketing carregou, nem o contrário —, e o efeito acumula: ao fim de um
-- ano a gaveta da equipa está cheia de ficheiros que só quem já saiu podia
-- tirar.
--
-- Duas funções novas em vez de alargar a da Fase 6, pela razão de sempre: a
-- original continua a ser do dono, que é o que a Cloud do cliente precisa, e
-- estas só tocam em `scope = 'staff'`. Alargar a existente mudava, numa linha,
-- o significado de "apagar" na Cloud de toda a gente.
--
-- **Soft delete, como em todo o lado** (07 §13.1): o ficheiro vai para a
-- reciclagem com `purge_after` a 30 dias, e `repor` traz-o de volta enquanto
-- lá estiver. Apagar por engano na gaveta partilhada de uma equipa é mais
-- provável, não menos — são mais mãos no mesmo sítio.
-- ---------------------------------------------------------------------------

create or replace function public.cloud_delete_staff_file(p_file_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scope public.cloud_scope;
  v_source public.file_source;
begin
  if not public.is_internal() then
    raise exception 'A Cloud interna é da equipa.' using errcode = '42501';
  end if;

  select scope, source into v_scope, v_source
    from public.files where id = p_file_id;

  if v_scope is null then
    raise exception 'Este ficheiro já não existe.' using errcode = 'P0002';
  end if;
  -- A função só conhece a Cloud da equipa. Um ficheiro pessoal apaga-se com
  -- `cloud_delete_file()`, pelo dono, e é assim que fica.
  if v_scope <> 'staff' then
    raise exception 'Este ficheiro não é da Cloud interna.' using errcode = '42501';
  end if;
  if v_source = 'property_document' then
    raise exception 'Este documento elimina-se no formulário do imóvel' using errcode = '42501';
  end if;

  update public.files
     set deleted_at = now(), purge_after = now() + interval '30 days'
   where id = p_file_id;
end;
$$;

comment on function public.cloud_delete_staff_file(uuid) is
  'P10-10: soft delete de um ficheiro da Cloud interna, por qualquer pessoa da equipa. A da Fase 6 continua a ser do dono.';

create or replace function public.cloud_restore_staff_file(p_file_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scope public.cloud_scope;
begin
  if not public.is_internal() then
    raise exception 'A Cloud interna é da equipa.' using errcode = '42501';
  end if;

  select scope into v_scope from public.files where id = p_file_id;

  if v_scope is null then
    raise exception 'Este ficheiro já não existe.' using errcode = 'P0002';
  end if;
  if v_scope <> 'staff' then
    raise exception 'Este ficheiro não é da Cloud interna.' using errcode = '42501';
  end if;

  -- Repor é limpar as duas datas: `purge_after` sozinho deixava o ficheiro
  -- visível e à espera de ser varrido na mesma.
  update public.files
     set deleted_at = null, purge_after = null
   where id = p_file_id;
end;
$$;

comment on function public.cloud_restore_staff_file(uuid) is
  'P10-10: tira um ficheiro da reciclagem da Cloud interna. Limpa deleted_at E purge_after — só a primeira deixava-o a ser varrido na mesma.';

revoke all on function public.cloud_delete_staff_file(uuid) from public, anon;
revoke all on function public.cloud_restore_staff_file(uuid) from public, anon;
grant execute on function public.cloud_delete_staff_file(uuid) to authenticated;
grant execute on function public.cloud_restore_staff_file(uuid) to authenticated;
