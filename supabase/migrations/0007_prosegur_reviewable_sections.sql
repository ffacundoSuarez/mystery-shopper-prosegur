-- Actualizar secciones revisables del Mystery Shopper Prosegur (3 partes)
create or replace function public.prosegur_reviewable_sections()
returns text[]
language sql
immutable
as $$
  select array['parte-1', 'parte-2', 'parte-3']::text[];
$$;
