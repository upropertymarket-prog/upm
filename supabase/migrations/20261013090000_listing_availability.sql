-- ---------------------------------------------------------------------------
-- listing_availability — distinguir "nunca existiu" de "já não está" (P2-05)
--
-- O problema: `properties_public` filtra `status in ('active','featured')`, por
-- isso um uuid inventado e uma propriedade vendida devolvem exatamente o mesmo
-- — nada. O site não consegue separar os dois casos e dá 404 aos dois.
--
-- Quem clica num link partilhado de um anúncio entretanto vendido não escreveu
-- o URL mal: a página existiu e ele talvez a tenha visto. Um "esta página não
-- existe" é, para essa pessoa, falso. Ela é também o visitante mais
-- qualificado que o site recebe — quis aquela tipologia, naquela zona, naquele
-- preço — e mandá-la para um 404 desperdiça-a.
--
-- ## O que esta função devolve, e o que recusa devolver
--
-- `security definer` porque tem de ler `public.properties`, cuja RLS só deixa
-- dono e staff. É a mesma exceção documentada de `get_property_location`
-- (08 §2.4), com `search_path` fixo pela mesma razão.
--
-- **Só revela o que já foi público.** A regra é `published_at is not null`:
--
--  - propriedade em `draft` que nunca foi publicada  → 'never'
--  - propriedade em `pending_review` ainda por aprovar → 'never'
--  - uuid que não existe                             → 'never'
--  - propriedade publicada e agora vendida/arrendada/
--    arquivada/devolvida a rascunho                  → 'gone'
--
-- Sem isto, a função passava a ser uma porta para adivinhar uuids e descobrir
-- que anúncios estão em preparação — exatamente o que `properties_public`
-- existe para impedir.
--
-- Para o caso 'gone' devolve ainda `deal` e `city`, e **só isso**. Não devolve
-- título, preço, morada nem nada do dono. Os dois campos que devolve estiveram
-- publicamente visíveis enquanto o anúncio esteve no ar, e são o que permite à
-- página sugerir alternativas na mesma cidade e no mesmo tipo de negócio — que
-- é o ponto todo de a página existir em vez de um 404.
--
-- `reason` é grosseiro de propósito: 'sold', 'rented' ou 'withdrawn'. Um
-- anúncio retirado não diz porquê — pode ter sido rejeitado na moderação, e
-- isso é entre a plataforma e o proprietário, não para quem passa.
-- ---------------------------------------------------------------------------

create or replace function public.listing_availability(p_property_id uuid)
returns table (outcome text, reason text, deal public.property_deal, city text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_status public.property_status;
  v_published_at timestamptz;
  v_deal public.property_deal;
  v_city text;
begin
  select p.status, p.published_at, p.deal, p.city
    into v_status, v_published_at, v_deal, v_city
    from public.properties p
   where p.id = p_property_id;

  -- Não existe, ou existe e nunca chegou a ser publicada: para quem está de
  -- fora são o mesmo caso, e é assim que tem de ser.
  if not found or v_published_at is null then
    return query select 'never'::text, null::text, null::public.property_deal, null::text;
    return;
  end if;

  -- Publicada e ainda no ar: quem chama devia tê-la obtido por
  -- `properties_public`. Devolve-se 'never' na mesma — esta função não é um
  -- segundo caminho de leitura de anúncios ativos.
  if v_status in ('active', 'featured') then
    return query select 'never'::text, null::text, null::public.property_deal, null::text;
    return;
  end if;

  return query
  select
    'gone'::text,
    case v_status
      when 'sold' then 'sold'
      when 'rented' then 'rented'
      else 'withdrawn'
    end::text,
    v_deal,
    v_city;
end;
$$;

comment on function public.listing_availability(uuid) is
  'P2-05: diz se um anúncio nunca foi público (never) ou se saiu de circulação (gone), para a página /imoveis/[slug] poder explicar em vez de dar 404. Só revela o que já esteve publicado, e apenas deal + city.';

grant execute on function public.listing_availability(uuid) to anon, authenticated;
