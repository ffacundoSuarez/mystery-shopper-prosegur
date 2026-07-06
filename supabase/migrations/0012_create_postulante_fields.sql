-- Crear postulante con nombre completo, país, idioma y reclutador.
-- La región NO se define desde el admin: la completa el encuestado en el screening.

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
  v_code := public.prosegur_generate_code();

  -- Separar nombre y apellido (primer espacio) para compatibilidad con columnas legacy
  v_space := position(' ' in v_full_name);
  if v_space > 0 then
    v_nombre := left(v_full_name, v_space - 1);
    v_apellido := trim(substring(v_full_name from v_space + 1));
  else
    v_nombre := v_full_name;
    v_apellido := '';
  end if;

  -- Solo se precarga nombre y país; la región la completa el encuestado
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

grant execute on function public.prosegur_admin_create_postulante(text, text, text, text, text) to anon, authenticated;
