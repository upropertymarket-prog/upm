-- UProperty Market — Fase 4 (P4-01b), correção a um bug real da Fase 2.
--
-- `property_media_public_select` (20260927090000_properties.sql) e
-- `property_media_objects_public_select` (20260928100000_property_storage.sql)
-- validam o imóvel com `exists (select 1 from public.properties p where ...)`.
-- Mas `properties` tem RLS própria (só dono/staff leem diretamente) — e essa
-- RLS aplica-se TAMBÉM dentro da subquery de outra policy. Para anon/buyer,
-- a subquery nunca vê nenhuma linha de `properties` (não são dono nem
-- staff), logo `exists(...)` é sempre falso, e nunca leem media/fotos de
-- imóveis publicados — independentemente do `status`.
--
-- Apanhado pelo teste de matriz de acesso da Fase 4 (P4-01b, fecha D14),
-- exatamente o tipo de coisa que essa cobertura existe para apanhar.
--
-- Correção: validar contra `properties_public` em vez de `properties`. A
-- view corre sem `security_invoker` (exceção documentada em
-- 20260927090100_property_privacy.sql) — não herda a RLS de quem chama, e já
-- filtra por `status in ('active','featured')`, por isso a subquery passa a
-- só precisar de confirmar que a linha existe lá.

alter policy property_media_public_select on public.property_media
  using (
    exists (select 1 from public.properties_public pp where pp.id = property_id)
  );

alter policy property_media_objects_public_select on storage.objects
  using (
    bucket_id = 'property-media'
    and exists (
      select 1 from public.properties_public pp where pp.id = (split_part(name, '/', 1))::uuid
    )
  );
