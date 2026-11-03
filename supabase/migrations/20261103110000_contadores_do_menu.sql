-- =========================================================================
-- F4 — os números do menu, contados na base (3 nov 2026)
-- =========================================================================
-- A barra lateral mostra três números: mensagens por ler, visitas que
-- esperam resposta minha e leads por contactar. Calculavam-se em JS a partir
-- das listas inteiras de conversas, visitas e leads — carregadas em **cada
-- uma das 11 páginas** da app, muitas delas só para isto. Trabalho por pedido
-- que cresce com o utilizador, e acima das 1000 linhas (o corte do
-- PostgREST) o número saía errado sem aviso. Ver 12 §30, F4.
--
-- Conta a partir das **mesmas funções** de onde as listas vêm, com as mesmas
-- regras que `countersFor` aplicava: uma definição só, dois sítios a lê-la.
--
--   messages       soma de `unread` de `my_conversations()`
--   waiting        visitas `pending`/`rescheduled` que eu não propus
--   leads          leads em `new`/`contacted` (0 para quem não é dono)
--
-- `security invoker`: as três funções já filtram por `auth.uid()`. Nasce sem
-- `anon` (A15); o `grant` ao `authenticated` fica escrito.
-- =========================================================================

create or replace function public.my_nav_counters()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'messages',
      (select coalesce(sum(c.unread), 0)::integer from public.my_conversations() c),
    'waiting',
      (select count(*)::integer
         from public.my_visit_requests() v
        where v.status in ('pending', 'rescheduled')
          and not v.proposed_by_me),
    'leads',
      (select count(*)::integer
         from public.my_owner_leads() l
        where l.stage in ('new', 'contacted'))
  );
$$;

revoke all on function public.my_nav_counters() from public, anon;
grant execute on function public.my_nav_counters() to authenticated, service_role;
