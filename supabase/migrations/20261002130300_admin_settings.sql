-- P8-05: Admin-controlled public settings and private feature flags.
drop policy feature_flags_select on public.feature_flags;
create policy feature_flags_select on public.feature_flags
  for select using (key = 'launch_mode' or public.is_staff());
drop policy feature_flags_admin_write on public.feature_flags;
revoke insert, update, delete on public.feature_flags from anon, authenticated;

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  public boolean not null default false,
  description text not null default '',
  updated_at timestamptz not null default now(),
  check (length(key) between 1 and 80)
);
alter table public.app_settings enable row level security;
create policy app_settings_select on public.app_settings for select
  using (app_settings.public or public.is_staff());
revoke all on public.app_settings from anon, authenticated;
grant select on public.app_settings to anon, authenticated;

insert into public.app_settings(key,value,public,description) values
  ('company_name','""'::jsonb,true,'Nome legal da empresa'),
  ('company_tax_id','""'::jsonb,true,'NIF da empresa'),
  ('company_address','""'::jsonb,true,'Morada da empresa'),
  ('company_phone','""'::jsonb,true,'Contacto telefónico público'),
  ('company_email','""'::jsonb,true,'E-mail público da empresa'),
  ('billing_email','""'::jsonb,true,'E-mail para faturação')
on conflict(key) do nothing;

create or replace function public.admin_feature_flags()
returns table(key text,value jsonb,description text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Sem permissao' using errcode='42501'; end if;
  return query select f.key,f.value,f.description from public.feature_flags f
    where f.key in ('launch_mode','interno_ip_allowlist') order by f.key;
end;
$$;

create or replace function public.admin_app_settings()
returns table(key text,value jsonb,public boolean,description text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Sem permissao' using errcode='42501'; end if;
  return query select s.key,s.value,s.public,s.description from public.app_settings s order by s.key;
end;
$$;

create or replace function public.set_feature_flag(p_key text,p_value jsonb)
returns void language plpgsql security definer set search_path = public
as $$
declare v_before jsonb;
begin
  perform public.require_step_up();
  if not public.is_admin() then raise exception 'Sem permissao' using errcode='42501'; end if;
  if p_key not in ('launch_mode','interno_ip_allowlist') then raise exception 'Chave de flag desconhecida' using errcode='22023'; end if;
  if p_value is null then raise exception 'Valor inválido' using errcode='22023'; end if;
  if p_key='launch_mode' and (jsonb_typeof(p_value)<>'string' or p_value #>> '{}' not in ('pre','post')) then
    raise exception 'Modo de lançamento inválido' using errcode='22023';
  end if;
  if p_key='interno_ip_allowlist' then
    if jsonb_typeof(p_value)<>'array' or jsonb_array_length(p_value)>64 then raise exception 'Lista de redes inválida' using errcode='22023'; end if;
    if exists(select 1 from jsonb_array_elements(p_value) e where jsonb_typeof(e)<>'string'
      or length(e #>> '{}')>64 or (e #>> '{}') !~ '^[0-9]{1,3}(\.[0-9]{1,3}){3}(/[0-9]{1,2})?$') then
      raise exception 'A lista aceita apenas IPv4 e CIDR IPv4' using errcode='22023';
    end if;
    begin
      perform (e #>> '{}')::inet from jsonb_array_elements(p_value) e;
    exception when others then raise exception 'Rede IPv4 inválida' using errcode='22023';
    end;
  end if;
  select f.value into v_before from public.feature_flags f where f.key=p_key for update;
  if not found then raise exception 'Flag não encontrada' using errcode='P0002'; end if;
  update public.feature_flags set value=p_value where key=p_key;
  perform public.write_audit_log('settings.feature_flag','feature_flags',null,jsonb_build_object('key',p_key,'before',v_before,'after',p_value));
end;
$$;

create or replace function public.set_app_setting(p_key text,p_value jsonb)
returns void language plpgsql security definer set search_path = public
as $$
declare v_before jsonb;
begin
  perform public.require_step_up();
  if not public.is_admin() then raise exception 'Sem permissao' using errcode='42501'; end if;
  if p_value is null then raise exception 'Valor inválido' using errcode='22023'; end if;
  if p_key not in ('company_name','company_tax_id','company_address','company_phone','company_email','billing_email')
    or jsonb_typeof(p_value)<>'string' or length(p_value #>> '{}')>500 then
    raise exception 'Definição inválida' using errcode='22023';
  end if;
  if p_key in ('company_email','billing_email') and nullif(btrim(p_value #>> '{}'),'') is not null
    and (p_value #>> '{}') !~* '^[A-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$' then
    raise exception 'Endereço de e-mail inválido' using errcode='22023';
  end if;
  select s.value into v_before from public.app_settings s where s.key=p_key for update;
  if not found then raise exception 'Definição não encontrada' using errcode='P0002'; end if;
  update public.app_settings set value=p_value where key=p_key;
  perform public.write_audit_log('settings.company','app_settings',null,jsonb_build_object('key',p_key,'before',v_before,'after',p_value));
end;
$$;

revoke all on function public.admin_feature_flags() from public,anon;
revoke all on function public.admin_app_settings() from public,anon;
revoke all on function public.set_feature_flag(text,jsonb) from public,anon;
revoke all on function public.set_app_setting(text,jsonb) from public,anon;
grant execute on function public.admin_feature_flags(),public.admin_app_settings() to authenticated;
grant execute on function public.set_feature_flag(text,jsonb),public.set_app_setting(text,jsonb) to authenticated;
comment on table public.app_settings is 'Allowlisted company information; public fields are visible to the public site.';
