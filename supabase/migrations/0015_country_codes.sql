-- IDs por país: 01ARG, 02ARG, 01URU, etc. (número + 3 letras del nombre en español)

-- Mapeo código de país (f1-pais) → sufijo de 3 letras
create or replace function public.prosegur_country_suffix(p_pais text)
returns text
language sql
immutable
as $$
  select case p_pais
    when '1' then 'ARG'  -- Argentina
    when '2' then 'COL'  -- Colombia
    when '3' then 'PER'  -- Perú
    when '4' then 'CHI'  -- Chile
    when '5' then 'PAR'  -- Paraguay
    when '6' then 'URU'  -- Uruguay
    when '7' then 'POR'  -- Portugal
    when '8' then 'ALE'  -- Alemania
    else null
  end;
$$;

-- Siguiente código para un país: cuenta existentes con el mismo sufijo
create or replace function public.prosegur_generate_code_for_country(p_pais text)
returns text
language plpgsql
as $$
declare
  v_suffix text;
  v_next int;
begin
  v_suffix := public.prosegur_country_suffix(p_pais);
  if v_suffix is null then
    raise exception 'País inválido: %', p_pais;
  end if;

  select coalesce(max(
    (regexp_match(code, '^(\d+)' || v_suffix || '$'))[1]::int
  ), 0) + 1
  into v_next
  from prosegur_responses
  where code ~ ('^\d+' || v_suffix || '$');

  return lpad(v_next::text, 2, '0') || v_suffix;
end;
$$;

-- Crear postulante: usa código por país en lugar de PS-xxx
create or replace function public.prosegur_admin_create_postulante(
  p_passcode text,
  p_nombre_apellido text,
  p_pais text,
  p_idioma text default 'es',
  p_reclutador text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.prosegur_responses%rowtype;
  v_code text;
  v_idioma text;
  v_full_name text;
  v_nombre text;
  v_apellido text;
  v_space int;
  v_answers jsonb;
begin
  if not public.prosegur_validate_passcode(p_passcode) then
    raise exception 'Passcode inválido';
  end if;

  v_full_name := trim(coalesce(p_nombre_apellido, ''));
  if v_full_name = '' then
    raise exception 'Nombre y apellido requerido';
  end if;

  if coalesce(p_pais, '') = '' then
    raise exception 'País requerido';
  end if;

  v_idioma := case when p_idioma = 'pt' then 'pt' else 'es' end;
  v_code := public.prosegur_generate_code_for_country(p_pais);

  v_space := position(' ' in v_full_name);
  if v_space > 0 then
    v_nombre := left(v_full_name, v_space - 1);
    v_apellido := trim(substring(v_full_name from v_space + 1));
  else
    v_nombre := v_full_name;
    v_apellido := '';
  end if;

  v_answers := jsonb_build_object(
    'nombre-apellido', v_full_name,
    'f1-pais', p_pais
  );

  if nullif(trim(coalesce(p_reclutador, '')), '') is not null then
    v_answers := v_answers || jsonb_build_object('reclutador', trim(p_reclutador));
  end if;

  insert into prosegur_responses (id, code, nombre, apellido, nombre_apellido, idioma, answers, stages)
  values (
    v_code,
    v_code,
    v_nombre,
    nullif(v_apellido, ''),
    v_full_name,
    v_idioma,
    v_answers,
    '{}'::jsonb
  )
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'code', v_row.code,
    'accessToken', v_row.access_token,
    'idioma', v_row.idioma,
    'nombre', v_row.nombre,
    'apellido', v_row.apellido,
    'nombreApellido', v_row.nombre_apellido,
    'answers', coalesce(v_row.answers, '{}'::jsonb),
    'stages', coalesce(v_row.stages, '{}'::jsonb),
    'createdAt', v_row.created_at
  );
end;
$$;

grant execute on function public.prosegur_country_suffix(text) to anon, authenticated;
grant execute on function public.prosegur_generate_code_for_country(text) to anon, authenticated;
grant execute on function public.prosegur_admin_create_postulante(text, text, text, text, text) to anon, authenticated;
