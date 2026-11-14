-- UProperty Market — seed da Fase 2, atualizado nas Fases 6 e 7.
--
-- PREÇOS: DECIDIDOS pelo cliente a 1 out 2026 (07 §8.3, §20.9). Deixam de ser
-- provisórios e a questão 07 §9 #2 fecha. A decisão nasceu de comparar a
-- grelha que o agente tinha proposto com os preços de uma tentativa anterior
-- encontrados na conta Stripe: o lado do proprietário subiu para perto desses
-- (que eram realistas), o lado do comprador ficou baixo (14,99 €/mês para
-- quem PROCURA casa punha portagem na procura), e os quatro degraus
-- mantiveram-se para a grelha de limites de §19.2 não perder um.
--
-- Regra do anual: **anual = 10 × mensal** (dois meses grátis).
--
-- LIMITES: DECIDIDOS a 30 set 2026 (07 §19.2). Fecham a dívida D22 e a
-- questão 07 §9 #1, e destravam o enforcement da Fase 7. `null` numa chave
-- significa ILIMITADO — nunca um número grande a fingir de infinito.
--
-- FIM DO GRATUITO — P9-05, decisão do cliente de 7 out 2026. O degrau
-- gratuito saiu da escada e não volta ao seed: quem se inscreve paga no
-- momento da inscrição, e não há trial gratuito. A linha `gratuito` continua a
-- existir nas bases onde já existia (as contas antigas apontavam para ela),
-- mas invisível — ver a migração `20261007120500_end_free_plan.sql`, que
-- também acrescenta o `check` que impede um plano a 0 € de voltar à escada.
-- Numa base nova, o plano simplesmente não nasce.

-- OFERTA DO 1.º ANO — cliente, 13 nov 2026 (`20261113090000_oferta_primeiro_ano.sql`).
-- O proprietário passa a 19,99 / 29,99 / 49,99 €/mês, com os primeiros 12 meses
-- a 10,99 / 14,99 / 29,99. `price_*` é o preço normal, o que vai para o `Price`
-- do Stripe; a oferta vive em `intro_*` e no Stripe é um `Coupon`.
insert into public.plans (slug, name, audience, price_year_cents, price_month_cents, "position", limits,
                          intro_price_year_cents, intro_price_month_cents, intro_months) values
  ('essential-owner', 'Essential', 'owner', 19990, 1999, 1,
    '{"active_properties": 3, "visits": 20, "active_chats": 15, "saved": 50, "alerts": 3, "cloud_gb": 2}',
    10990, 1099, 12),
  ('smarter-owner', 'Smarter', 'owner', 29990, 2999, 2,
    '{"active_properties": 10, "visits": 60, "active_chats": 50, "saved": 200, "alerts": 10, "cloud_gb": 5}',
    14990, 1499, 12),
  ('premium-owner', 'Premium', 'owner', 49990, 4999, 3,
    '{"active_properties": null, "visits": null, "active_chats": null, "saved": null, "alerts": 20, "cloud_gb": 20}',
    29990, 2999, 12),
  ('smarter-buyer', 'Smarter', 'buyer', 4990, 499, 1,
    '{"visits": 15, "active_chats": 20, "saved": 100, "alerts": 5, "cloud_gb": 1}',
    null, null, null),
  ('premium-buyer', 'Premium', 'buyer', 6990, 699, 2,
    '{"visits": null, "active_chats": null, "saved": null, "alerts": 20, "cloud_gb": 5}',
    null, null, null)
on conflict (slug) do update set
  name = excluded.name,
  audience = excluded.audience,
  price_year_cents = excluded.price_year_cents,
  price_month_cents = excluded.price_month_cents,
  "position" = excluded."position",
  limits = excluded.limits,
  intro_price_year_cents = excluded.intro_price_year_cents,
  intro_price_month_cents = excluded.intro_price_month_cents,
  intro_months = excluded.intro_months;

-- Extra de subscrição — 07 §19.3. Soma-se ao que o plano dá, é único por
-- conta e não levanta mais nenhum limite. Os IDs do Stripe ficam null até
-- P7-01, tal como os de `plans`.
insert into public.addons (slug, name, price_month_cents, price_year_cents, grants, "position") values
  ('cloud-5gb', 'Cloud 5 GB', 299, 2990, '{"cloud_gb": 5}', 0)
on conflict (slug) do update set
  name = excluded.name,
  price_month_cents = excluded.price_month_cents,
  price_year_cents = excluded.price_year_cents,
  grants = excluded.grants,
  "position" = excluded."position";

-- ---------------------------------------------------------------------------
-- Modelos de contrato — P6-04 (05 §6.5)
--
-- Publicar modelos é do Admin, em `apps/interno`. Estes dois existem no seed
-- porque sem um modelo publicado o ecrã `/contratos` do proprietário não tem
-- por onde começar: um CONTRATO gera-se sempre de um MODELO, nunca do nada.
--
-- O corpo é um documento TipTap. As variáveis são nós `variable` — é o que
-- 04 §8.3 chama "variáveis em chip" —, e o `variables[]` ao lado é a lista que
-- o editor usa para montar o painel de preenchimento. Os dois têm de dizer o
-- mesmo; quem editar um edita o outro.
--
-- Texto deliberadamente curto e neutro: NÃO é minuta jurídica revista, é
-- estrutura. O conteúdo legal a sério entra com os modelos que o cliente
-- aprovar, pelo Admin, com versão própria.
-- ---------------------------------------------------------------------------

insert into public.contract_templates (family_id, kind, name, version, status, variables, body) values
  (
    '11111111-1111-4111-8111-111111111111', 'sale',
    'Contrato de compra e venda', 1, 'published',
    array['proprietario', 'comprador', 'imovel', 'morada', 'preco', 'data'],
    '{"type":"doc","content":[
      {"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Contrato de compra e venda"}]},
      {"type":"paragraph","content":[
        {"type":"text","text":"Entre "},
        {"type":"variable","attrs":{"name":"proprietario","label":"Proprietário"}},
        {"type":"text","text":", adiante designado por vendedor, e "},
        {"type":"variable","attrs":{"name":"comprador","label":"Comprador"}},
        {"type":"text","text":", adiante designado por comprador, é celebrado o presente contrato."}
      ]},
      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Objeto"}]},
      {"type":"paragraph","content":[
        {"type":"text","text":"O vendedor promete vender o imóvel "},
        {"type":"variable","attrs":{"name":"imovel","label":"Imóvel"}},
        {"type":"text","text":", sito em "},
        {"type":"variable","attrs":{"name":"morada","label":"Morada"}},
        {"type":"text","text":"."}
      ]},
      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Preço"}]},
      {"type":"paragraph","content":[
        {"type":"text","text":"O preço acordado é de "},
        {"type":"variable","attrs":{"name":"preco","label":"Preço"}},
        {"type":"text","text":", a pagar nos termos adiante previstos."}
      ]},
      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Data"}]},
      {"type":"paragraph","content":[
        {"type":"text","text":"Celebrado em "},
        {"type":"variable","attrs":{"name":"data","label":"Data"}},
        {"type":"text","text":"."}
      ]}
    ]}'::jsonb
  ),
  (
    '22222222-2222-4222-8222-222222222222', 'rent',
    'Contrato de arrendamento', 1, 'published',
    array['proprietario', 'inquilino', 'imovel', 'morada', 'renda', 'prazo', 'data'],
    '{"type":"doc","content":[
      {"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Contrato de arrendamento"}]},
      {"type":"paragraph","content":[
        {"type":"text","text":"Entre "},
        {"type":"variable","attrs":{"name":"proprietario","label":"Proprietário"}},
        {"type":"text","text":", adiante designado por senhorio, e "},
        {"type":"variable","attrs":{"name":"inquilino","label":"Inquilino"}},
        {"type":"text","text":", adiante designado por arrendatário, é celebrado o presente contrato."}
      ]},
      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Objeto"}]},
      {"type":"paragraph","content":[
        {"type":"text","text":"O senhorio dá de arrendamento o imóvel "},
        {"type":"variable","attrs":{"name":"imovel","label":"Imóvel"}},
        {"type":"text","text":", sito em "},
        {"type":"variable","attrs":{"name":"morada","label":"Morada"}},
        {"type":"text","text":"."}
      ]},
      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Renda e prazo"}]},
      {"type":"paragraph","content":[
        {"type":"text","text":"A renda mensal é de "},
        {"type":"variable","attrs":{"name":"renda","label":"Renda"}},
        {"type":"text","text":", pelo prazo de "},
        {"type":"variable","attrs":{"name":"prazo","label":"Prazo"}},
        {"type":"text","text":"."}
      ]},
      {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Data"}]},
      {"type":"paragraph","content":[
        {"type":"text","text":"Celebrado em "},
        {"type":"variable","attrs":{"name":"data","label":"Data"}},
        {"type":"text","text":"."}
      ]}
    ]}'::jsonb
  )
on conflict (family_id, version) do update set
  name = excluded.name,
  kind = excluded.kind,
  status = excluded.status,
  variables = excluded.variables,
  body = excluded.body;

-- ---------------------------------------------------------------------------
-- Tráfego do site — dados de demonstração (Fase 8, P8-06)
-- ---------------------------------------------------------------------------
-- A lógica vive em `seed_demo_site_analytics()` (migração 20261002120500) e não
-- aqui: o `seed.sql` só corre num ambiente novo, e em staging não se faz reset.
-- Com a lógica na função, os dois caminhos usam a mesma definição.

select public.seed_demo_site_analytics(45);

-- Leads fictícias para rever a CRM antes de P2-02 ligar os formulários públicos.
insert into public.site_leads (
  id, source, form, name, email, phone, profile_type, reason, message,
  utm, status, consent_marketing, consent_at, created_at
) values
  ('a8000000-0000-4000-8000-000000000001','pre_launch','preinscricao','Ana Demonstração','ana@example.invalid',null,'buyer','Procura casa','Procuro um T2 na zona de Lisboa.','{"utm_source":"demo"}'::jsonb,'new',false,null,now()-interval '2 days'),
  ('a8000000-0000-4000-8000-000000000002','pre_launch','empresas','Equipa Exemplo','contacto@example.invalid','+351 210 000 000','empresa','Parceria','Gostávamos de conhecer a solução para a nossa equipa.','{}'::jsonb,'contacted',false,null,now()-interval '5 days')
on conflict (id) do nothing;
