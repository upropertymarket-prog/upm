-- UProperty Market — seed da Fase 2.
-- PROVISÓRIO: preços de 07 §8.3, decididos pelo agente a pedido do cliente
-- ("aplica o que achares melhor, depois alteramos"). Não comunicar ao
-- exterior sem confirmação. limits fica null (07 §9 #1) até o cliente
-- decidir active_properties/visits/active_chats/saved/alerts/cloud_gb —
-- o enforcement da Fase 8 não pode ligar-se enquanto isto for null.

insert into public.plans (slug, name, audience, price_year_cents, price_month_cents, "position") values
  ('gratuito', 'Gratuito', 'both', 0, 0, 0),
  ('essential-owner', 'Essential', 'owner', 5990, 599, 1),
  ('smarter-owner', 'Smarter', 'owner', 12990, 1299, 2),
  ('premium-owner', 'Premium', 'owner', 24990, 2499, 3),
  ('smarter-buyer', 'Smarter', 'buyer', 2990, 299, 1),
  ('premium-buyer', 'Premium', 'buyer', 4990, 499, 2)
on conflict (slug) do nothing;
