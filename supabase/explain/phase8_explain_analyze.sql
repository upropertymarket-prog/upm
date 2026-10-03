-- Fase 8 — EXPLAIN ANALYZE (staging). Executar no SQL Editor do Supabase (role postgres).
-- Tudo em transação READ ONLY + ROLLBACK. Correr cada bloco separadamente e guardar o output.
-- As funções PL/pgSQL fazem "Function Scan" opaco, por isso analisamos as queries internas.

-- 0) Volumetria (contexto para interpretar os planos)
begin read only;
select 'profiles' t, count(*) from public.profiles
union all select 'properties', count(*) from public.properties
union all select 'site_leads', count(*) from public.site_leads
union all select 'site_analytics_daily', count(*) from public.site_analytics_daily
union all select 'audit_log', count(*) from public.audit_log;
rollback;

-- 1) Dashboard — registos 30d (profiles.created_at)
begin read only;
explain (analyze, buffers)
select created_at::date, count(*) from public.profiles
where created_at >= current_date - 29 and created_at < current_date + 1 and role in ('buyer','owner')
group by created_at::date;
rollback;

-- 2) Dashboard — submissões 30d (properties.submitted_at)
begin read only;
explain (analyze, buffers)
select submitted_at::date, count(*) from public.properties
where submitted_at >= current_date - 29 and submitted_at < current_date + 1
group by submitted_at::date;
rollback;

-- 3) Dashboard — atividade recente (audit_log, top 10 por created_at)
begin read only;
explain (analyze, buffers)
select l.action, l.entity, l.created_at from public.audit_log l
where l.action in ('property.approved','property.rejected','property.featured','property.unfeatured','property.reopened','profile.suspended','profile.reactivated','site_lead.status','site_lead.assignment','plan.updated','plan.created','settings.feature_flag','settings.company','site_leads.export')
order by l.created_at desc limit 10;
rollback;

-- 4) Dashboard — contagens do resumo
begin read only;
explain (analyze, buffers)
select
  (select count(*) from public.profiles),
  (select count(*) from public.profiles where created_at >= now() - interval '30 days'),
  (select count(*) from public.profiles where role = 'buyer'),
  (select count(*) from public.profiles where role = 'owner'),
  (select count(*) from public.properties where status = 'active'),
  (select count(*) from public.properties where status = 'featured'),
  (select count(*) from public.properties where status = 'pending_review'),
  (select count(*) from public.site_leads where status = 'new');
rollback;

-- 5) Leads — listagem paginada (índice site_leads_status_created_idx)
begin read only;
explain (analyze, buffers)
select l.*, pr.full_name
from public.site_leads l left join public.profiles pr on pr.id = l.assigned_to
where l.status = 'new'
order by l.created_at desc, l.id desc
limit 25;
rollback;

-- 6) Leads — pesquisa por nome/email (strpos, sem índice: esperado Seq Scan; ver volumetria)
begin read only;
explain (analyze, buffers)
select l.id from public.site_leads l
where strpos(lower(l.name), 'silva') > 0 or strpos(lower(l.email), 'silva') > 0
order by l.created_at desc, l.id desc
limit 25;
rollback;

-- 7) Moderação — fila pending_review com capa (lateral join em property_media)
begin read only;
explain (analyze, buffers)
select p.id, p.ref, p.title, pr.full_name, media.path, p.created_at
from public.properties p
join public.profiles pr on pr.id = p.owner_id
left join lateral (
  select m.path from public.property_media m
  where m.property_id = p.id and m.kind = 'photo'
  order by m.is_cover desc, m.position asc, m.id asc
  limit 1
) media on true
where p.status = 'pending_review'
order by p.created_at desc, p.id desc
limit 25;
rollback;

-- 8) Tráfego — agregação dos últimos 30 dias (summary/series)
begin read only;
explain (analyze, buffers)
select coalesce(sum(a.visits),0), coalesce(sum(a.uniques),0), coalesce(sum(a.conversions),0)
from public.site_analytics_daily a
where a.date between current_date - 29 and current_date
  and public.is_analytics_total_row(a.path, a.source, a.device, a.city);
rollback;

-- Critérios: sem Seq Scan em tabelas grandes nos blocos 1,2,3,5,7,8; Execution Time < 50 ms
-- com a volumetria de staging. O bloco 6 é Seq Scan por desenho — reavaliar (pg_trgm) se
-- site_leads passar de ~50k linhas.
