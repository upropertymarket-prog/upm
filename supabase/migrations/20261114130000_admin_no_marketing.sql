-- O Admin também é o Marketing (14 nov 2026)
-- =========================================================================
-- Pedido do cliente: "o admin tem de ser também o módulo do marketing". O
-- módulo inteiro — Atualizações, Campanhas, Modelos de e-mail, Métricas —
-- passa a estar no menu do Admin, nas mesmas rotas de `/marketing`.
--
-- Tudo o que o Marketing lê e escreve passa por `is_marketing()`: 14 políticas
-- (app_updates, campaigns, scheduled_sends, email_events, os dois buckets de
-- imagens, …) e 18 funções (`campaign_*`, `app_update_*`, `template_*`). Abrir
-- o predicado é abrir o módulo num sítio só, em vez de 32 — e um sítio que
-- ficasse esquecido seria um ecrã que abre e uma ação que falha.
--
-- Só num sentido: o marketing continua sem `is_admin()`, sem moderação nem
-- diretório de utilizadores. `is_staff()` também não muda.

create or replace function public.is_marketing()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    (select role in ('marketing', 'admin') from public.profiles where id = auth.uid()),
    false
  );
$$;
