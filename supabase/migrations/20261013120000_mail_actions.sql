-- ---------------------------------------------------------------------------
-- A Caixa de e-mail do Suporte: o que a equipa pode fazer (P10-04 · 04 §2.5)
--
-- A migração do correio (20261013110000) deu leitura ao staff e **nenhuma
-- escrita**: quem escrevia era só o `mail-worker`, com `service_role`. O ecrã
-- `/suporte/email` traz os botões, e com eles a pergunta de quem pode mexer em
-- quê.
--
-- ## Porque é que não há `update` direto em `mail_messages`
--
-- Marcar como lida, pôr estrela, arquivar e etiquetar são quatro escritas
-- inofensivas. Mas uma policy de `update` numa tabela não distingue colunas: a
-- mesma policy que deixa marcar como lida deixa **reescrever o `html`, o
-- `from_address` e a data** de um e-mail recebido. Isso não é um ecrã a
-- funcionar mal — é falsificação de prova, numa caixa que serve para resolver
-- disputas com clientes.
--
-- Por isso as quatro escritas passam por funções `security definer`, cada uma
-- com o seu conjunto fechado de colunas, e `mail_messages` continua sem policy
-- de escrita nenhuma. É a mesma figura de `report_problem()`, que existe para o
-- cliente não escolher o `fingerprint` nem o `reporter_id`.
--
-- ## Quem escreve é o Suporte, não o staff
--
-- `is_staff()` é `admin | support`. A leitura do correio é dos dois (o Admin
-- configura as caixas e tem de poder confirmar que uma delas recebe), mas o
-- **trabalho** é do Suporte — como em `/admin/tickets`, que é só de leitura
-- (07 §5.10). Daí `is_support()`, que nasce aqui com nome próprio em vez de
-- ser repetido como subconsulta em cada policy.
-- ---------------------------------------------------------------------------

create or replace function public.is_support()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'support' from public.profiles where id = auth.uid()),
    false
  );
$$;

comment on function public.is_support() is
  'Verdadeiro para o papel support. O Admin NÃO entra: o workflow de suporte é do Suporte (07 §5.10).';

-- ---------------------------------------------------------------------------
-- Marcadores — aqui uma policy chega
--
-- Um marcador é um nome e uma cor; não há nada para falsificar. O que a policy
-- protege é o óbvio: só o Suporte os cria, renomeia e apaga.
-- ---------------------------------------------------------------------------

create policy mail_labels_support_write on public.mail_labels
  for all using (public.is_support()) with check (public.is_support());

-- ---------------------------------------------------------------------------
-- mail_set_flags — lida / não lida e estrela
-- ---------------------------------------------------------------------------

create or replace function public.mail_set_flags(
  p_message_id uuid,
  p_is_read boolean default null,
  p_is_starred boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_support() then
    raise exception 'Apenas o Suporte pode alterar o estado de uma mensagem.'
      using errcode = '42501';
  end if;

  update public.mail_messages
     set is_read = coalesce(p_is_read, is_read),
         is_starred = coalesce(p_is_starred, is_starred)
   where id = p_message_id;

  if not found then
    raise exception 'Mensagem inexistente.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.mail_set_flags(uuid, boolean, boolean) from public, anon;
grant execute on function public.mail_set_flags(uuid, boolean, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- mail_move — arquivar e desarquivar
--
-- `sent` e `drafts` não são destinos de uma ação de utilizador: uma mensagem
-- está em `sent` porque foi enviada, não porque alguém a arrastou para lá.
-- Mover para esses valores mentiria sobre a origem da mensagem.
-- ---------------------------------------------------------------------------

create or replace function public.mail_move(p_message_id uuid, p_folder public.mail_folder)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_support() then
    raise exception 'Apenas o Suporte pode arquivar mensagens.' using errcode = '42501';
  end if;

  if p_folder not in ('inbox', 'archive') then
    raise exception 'Só é possível mover entre a entrada e o arquivo.'
      using errcode = '22023';
  end if;

  update public.mail_messages set folder = p_folder where id = p_message_id;

  if not found then
    raise exception 'Mensagem inexistente.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.mail_move(uuid, public.mail_folder) from public, anon;
grant execute on function public.mail_move(uuid, public.mail_folder) to authenticated;

-- ---------------------------------------------------------------------------
-- mail_set_labels — substitui o conjunto, e valida que os marcadores são da
-- mesma caixa
--
-- Sem a validação, um marcador da caixa "faturacao@" podia ser colado numa
-- mensagem de "suporte@", e o filtro por marcador passava a devolver correio de
-- outra caixa — com o nome de um marcador que ali não existe.
-- ---------------------------------------------------------------------------

create or replace function public.mail_set_labels(p_message_id uuid, p_labels uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mailbox uuid;
  v_labels uuid[] := coalesce(p_labels, '{}');
  v_alheios integer;
begin
  if not public.is_support() then
    raise exception 'Apenas o Suporte pode etiquetar mensagens.' using errcode = '42501';
  end if;

  select mailbox_id into v_mailbox from public.mail_messages where id = p_message_id;
  if not found then
    raise exception 'Mensagem inexistente.' using errcode = 'P0002';
  end if;

  select count(*) into v_alheios
    from unnest(v_labels) as wanted(id)
    left join public.mail_labels l on l.id = wanted.id and l.mailbox_id = v_mailbox
   where l.id is null;

  if v_alheios > 0 then
    raise exception 'Há marcadores que não pertencem a esta caixa.' using errcode = '22023';
  end if;

  update public.mail_messages set labels = v_labels where id = p_message_id;
end;
$$;

revoke all on function public.mail_set_labels(uuid, uuid[]) from public, anon;
grant execute on function public.mail_set_labels(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- create_ticket_from_mail — "Criar ticket" a partir do e-mail (04 §2.5)
--
-- **O ticket nasce sem `reporter_id`.** Quem escreveu para o suporte não tem
-- conta — e `reporter_id` é uma chave estrangeira para `profiles`, não um
-- campo de texto. Pôr lá o id de quem carregou no botão seria dizer que o
-- problema foi reportado por alguém do Suporte, e esse ticket apareceria em
-- "Os meus reports" dessa pessoa. O remetente real fica na descrição, que é
-- onde se lê.
--
-- O `fingerprint` é o `message_id` do e-mail: único por mensagem, e por isso
-- carregar duas vezes no botão devolve o mesmo ticket em vez de criar dois.
-- A ligação fica nos dois sentidos — `mail_messages.ticket_id` e a descrição.
-- ---------------------------------------------------------------------------

create or replace function public.create_ticket_from_mail(p_message_id uuid)
returns table (id uuid, ref text, created boolean)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  m public.mail_messages;
  v_id uuid;
  v_ref text;
  v_title text;
  v_fingerprint text;
begin
  if not public.is_support() then
    raise exception 'Apenas o Suporte pode criar tickets a partir do correio.'
      using errcode = '42501';
  end if;

  select * into m from public.mail_messages where mail_messages.id = p_message_id;
  if not found then
    raise exception 'Mensagem inexistente.' using errcode = 'P0002';
  end if;

  if m.ticket_id is not null then
    select t.id, t.ref into v_id, v_ref from public.tickets t where t.id = m.ticket_id;
    return query select v_id, v_ref, false;
    return;
  end if;

  v_fingerprint := 'mail:' || m.message_id;

  select t.id, t.ref into v_id, v_ref
    from public.tickets t where t.fingerprint = v_fingerprint;

  if v_id is null then
    -- O título é o assunto; um assunto vazio dá um título honesto em vez de
    -- rebentar o `check` de comprimento mínimo da tabela.
    v_title := nullif(btrim(m.subject), '');
    if v_title is null then
      v_title := 'E-mail sem assunto de ' || coalesce(nullif(m.from_address, ''), 'remetente desconhecido');
    end if;
    v_title := left(v_title, 200);

    insert into public.tickets (reporter_id, title, description, origin, fingerprint, severity)
    values (
      null,
      v_title,
      left(
        'Recebido por e-mail de ' ||
        coalesce(nullif(m.from_name, ''), nullif(m.from_address, ''), 'remetente desconhecido') ||
        coalesce(' <' || nullif(m.from_address, '') || '>', '') || E'\n\n' ||
        coalesce(m.text_body, ''),
        5000
      ),
      'report',
      v_fingerprint,
      'medium'
    )
    returning tickets.id, tickets.ref into v_id, v_ref;

    insert into public.ticket_events (ticket_id, status_to, note, actor_id)
    values (v_id, 'new', 'Criado a partir de um e-mail do Suporte.', auth.uid());
  end if;

  update public.mail_messages set ticket_id = v_id where mail_messages.id = p_message_id;

  return query select v_id, v_ref, true;
end;
$$;

revoke all on function public.create_ticket_from_mail(uuid) from public, anon;
grant execute on function public.create_ticket_from_mail(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- mail_unread_count — o contador do menu do Suporte (07 §4.1)
--
-- Uma função e não um `select count(*)` da app: o contador aparece em todas as
-- páginas do Suporte, e uma função `stable` com o filtro já escrito evita que
-- cada chamador invente o seu (e conte o arquivo, por exemplo).
-- ---------------------------------------------------------------------------

create or replace function public.mail_unread_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_staff() then (
      select count(*)::integer
        from public.mail_messages
       where folder = 'inbox' and is_read = false
    )
    else 0
  end;
$$;

revoke all on function public.mail_unread_count() from public, anon;
grant execute on function public.mail_unread_count() to authenticated;
