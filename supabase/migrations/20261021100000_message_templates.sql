-- ---------------------------------------------------------------------------
-- `message_templates` — os modelos de e-mail do Marketing (21 out 2026)
-- ===========================================================================
-- Decisão do cliente de 21 out 2026. **O Marketing escreve, toda a equipa
-- usa.** Hoje cada pessoa redige do zero a resposta a uma lead, a um
-- proprietário ou a um comprador — e o que sai pela mesma caixa diz a mesma
-- coisa de dez maneiras. Estes modelos são o texto aprovado: escrevem-se uma
-- vez, no Marketing, e aparecem no compositor de e-mail de quem responde.
--
-- ## Só e-mail
--
-- Por decisão explícita do cliente. A referência que lhe deu a ideia tinha
-- WhatsApp e SMS; nós não temos nem um nem outro em lado nenhum do produto, e
-- uma coluna `channel` com um único valor possível é uma coluna que mente
-- sobre o que o produto faz. Quando houver um segundo canal, acrescenta-se —
-- e aí a coluna significa alguma coisa.
--
-- ## Porquê uma tabela nova e não `email_signatures`
--
-- São a mesma forma — texto reutilizável com variáveis, escrito no interno —
-- mas não o mesmo papel. Uma assinatura é **de uma caixa** e entra em todos os
-- e-mails que saem dela, sem ninguém escolher. Um modelo é **de um assunto** e
-- escolhe-se. Juntá-los dava uma tabela com metade das colunas sempre nulas.
--
-- ## A categoria sai do produto, não da referência
--
-- As categorias da referência (Follow-Up, Documentação, Proposta) são de um CRM
-- de crédito. As nossas são os assuntos sobre que esta equipa escreve, e cada
-- uma corresponde a uma área real da app: a lead que chega do site, o imóvel, a
-- visita, o contrato, a subscrição, e o apoio que não é nada disso.
-- ---------------------------------------------------------------------------

create type public.message_template_category as enum (
  'lead',
  'property',
  'visit',
  'contract',
  'billing',
  'support'
);

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),

  -- O nome é para quem escolhe o modelo na lista; o assunto é o que o
  -- destinatário vê. São coisas diferentes e é por isso que são dois campos:
  -- "Primeiro contacto — proprietário" ajuda a escolher, e não serve de
  -- assunto a nada.
  name text not null check (length(btrim(name)) between 1 and 120),
  category public.message_template_category not null default 'support',
  subject text not null check (length(subject) <= 300),

  -- HTML do mesmo editor dos contratos e das campanhas. Sanitizado na escrita,
  -- como as novidades e as campanhas — ver `message-templates.ts`.
  body_html text not null default '',

  -- **Inativo em vez de apagado.** Um modelo que deixou de se usar não se apaga
  -- enquanto não se souber se alguém o quer de volta; e um modelo apagado
  -- deixava os e-mails que o usaram sem explicação para o texto que levam. O
  -- compositor só oferece os ativos; a lista do Marketing mostra os dois.
  is_active boolean not null default true,

  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.message_templates is
  'Modelos de e-mail escritos pelo Marketing e usados por toda a equipa no '
  'compositor (21 out 2026). O Marketing escreve; quem tem caixa de e-mail usa.';
comment on column public.message_templates.name is
  'Nome para quem escolhe o modelo. Não é o assunto do e-mail.';
comment on column public.message_templates.is_active is
  'Inativo sai do compositor mas fica na lista do Marketing.';

create index message_templates_active_idx
  on public.message_templates (category, name)
  where is_active;

create trigger message_templates_set_updated_at
  before update on public.message_templates
  for each row execute function public.set_updated_at();

alter table public.message_templates enable row level security;

-- ---------------------------------------------------------------------------
-- Quem lê e quem escreve
--
-- **Lê quem é da equipa.** É o ponto da funcionalidade: o modelo não serve de
-- nada se só o Marketing o vir. `is_staff()` cobre o Suporte, o Admin e o
-- próprio Marketing — e é a mesma policy de leitura que as assinaturas têm,
-- pela mesma razão.
--
-- **Escreve o Marketing e o Admin.** O Marketing porque é dono do texto; o
-- Admin porque é dono de tudo e porque alguém tem de poder corrigir um modelo
-- num domingo. O Suporte não escreve: se pudesse, o "texto aprovado" deixava
-- de o ser à primeira pressa.
-- ---------------------------------------------------------------------------

create policy message_templates_staff_select on public.message_templates
  for select using (public.is_staff());

-- ---------------------------------------------------------------------------
-- template_save — a única porta de escrita a partir de uma sessão
--
-- Função e não policy de `insert`/`update`, pelas mesmas duas razões de
-- `admin_save_seo_page`: `updated_by` fixa-se em `auth.uid()` e nunca é aceite
-- de quem chama, e a verificação de papel fica num sítio só. É `security
-- definer`, por isso verifica o papel à cabeça — senão era a porta das
-- traseiras da tabela que acabámos de proteger.
--
-- `p_id` nulo cria; com valor, edita. Devolve o `id` para o editor continuar a
-- gravar por cima da linha que nasceu — igual ao `email_signature_save`.
-- ---------------------------------------------------------------------------

create or replace function public.template_save(
  p_id uuid,
  p_name text,
  p_category public.message_template_category,
  p_subject text,
  p_body_html text,
  p_is_active boolean
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
begin
  if not (public.is_marketing() or public.is_admin()) then
    raise exception 'not_authorized' using hint = 'not_authorized';
  end if;

  if v_name = '' then
    raise exception 'name_required' using hint = 'name_required';
  end if;

  if p_id is null then
    insert into public.message_templates (
      name, category, subject, body_html, is_active, created_by, updated_by
    )
    values (
      v_name, coalesce(p_category, 'support'), coalesce(p_subject, ''),
      coalesce(p_body_html, ''), coalesce(p_is_active, true), auth.uid(), auth.uid()
    )
    returning id into v_id;
  else
    update public.message_templates set
      name = v_name,
      category = coalesce(p_category, category),
      subject = coalesce(p_subject, ''),
      body_html = coalesce(p_body_html, ''),
      is_active = coalesce(p_is_active, is_active),
      updated_by = auth.uid()
    where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'not_found' using hint = 'not_found';
    end if;
  end if;

  return v_id;
end;
$$;

revoke all on function public.template_save(
  uuid, text, public.message_template_category, text, text, boolean
) from public, anon;
grant execute on function public.template_save(
  uuid, text, public.message_template_category, text, text, boolean
) to authenticated;

-- ---------------------------------------------------------------------------
-- template_delete — e porque é que existe mesmo havendo "inativo"
--
-- Inativar é o gesto normal e é o que a lista oferece primeiro. Apagar existe
-- para o que nunca devia ter sido escrito: um modelo criado por engano, um
-- rascunho com dados de um cliente lá dentro. Esse não se inativa — tira-se.
-- ---------------------------------------------------------------------------

create or replace function public.template_delete(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not (public.is_marketing() or public.is_admin()) then
    raise exception 'not_authorized' using hint = 'not_authorized';
  end if;

  delete from public.message_templates where id = p_id;
end;
$$;

revoke all on function public.template_delete(uuid) from public, anon;
grant execute on function public.template_delete(uuid) to authenticated;
