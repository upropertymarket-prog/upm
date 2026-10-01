-- UProperty Market — seed da Fase 2, atualizado na Fase 6.
--
-- PREÇOS: continuam PROVISÓRIOS (07 §8.3), decididos pelo agente a pedido do
-- cliente ("aplica o que achares melhor, depois alteramos"). Não comunicar ao
-- exterior sem confirmação — 07 §9 #2 mantém-se aberta.
--
-- LIMITES: DECIDIDOS a 30 set 2026 (07 §19.2). Fecham a dívida D22 e a
-- questão 07 §9 #1, e destravam o enforcement da Fase 7. `null` numa chave
-- significa ILIMITADO — nunca um número grande a fingir de infinito.
--
-- Nota sobre o Gratuito: é UMA linha com `audience = 'both'`, por isso serve
-- proprietários e compradores ao mesmo tempo. A grelha de 07 §19.2 dava-lhe
-- `visits` 5 do lado do proprietário e 3 do lado do comprador; com uma linha
-- só, fica o valor mais generoso (5). Separar em dois planos obrigaria a
-- mudar slugs já sedeados e referenciados — não compensa por um valor.

insert into public.plans (slug, name, audience, price_year_cents, price_month_cents, "position", limits) values
  ('gratuito', 'Gratuito', 'both', 0, 0, 0,
    '{"active_properties": 1, "visits": 5, "active_chats": 3, "saved": 10, "alerts": 1, "cloud_gb": 0}'),
  ('essential-owner', 'Essential', 'owner', 5990, 599, 1,
    '{"active_properties": 3, "visits": 20, "active_chats": 15, "saved": 50, "alerts": 3, "cloud_gb": 2}'),
  ('smarter-owner', 'Smarter', 'owner', 12990, 1299, 2,
    '{"active_properties": 10, "visits": 60, "active_chats": 50, "saved": 200, "alerts": 10, "cloud_gb": 5}'),
  ('premium-owner', 'Premium', 'owner', 24990, 2499, 3,
    '{"active_properties": null, "visits": null, "active_chats": null, "saved": null, "alerts": 20, "cloud_gb": 20}'),
  ('smarter-buyer', 'Smarter', 'buyer', 2990, 299, 1,
    '{"visits": 15, "active_chats": 20, "saved": 100, "alerts": 5, "cloud_gb": 1}'),
  ('premium-buyer', 'Premium', 'buyer', 4990, 499, 2,
    '{"visits": null, "active_chats": null, "saved": null, "alerts": 20, "cloud_gb": 5}')
on conflict (slug) do update set
  name = excluded.name,
  audience = excluded.audience,
  price_year_cents = excluded.price_year_cents,
  price_month_cents = excluded.price_month_cents,
  "position" = excluded."position",
  limits = excluded.limits;

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
