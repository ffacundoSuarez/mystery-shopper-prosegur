-- Encuestas de prueba (T01ARG) + is_prueba en listados y resultados públicos

alter table public.prosegur_responses
  add column if not exists is_prueba boolean not null default false;

-- Reemplazar generador: reales 01ARG, pruebas T01ARG (contador separado por país)
drop function if exists public.prosegur_generate_code_for_country(text);

create or replace function public.prosegur_generate_code_for_country(
  p_pais text,
  p_is_prueba boolean default false
)
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

  if p_is_prueba then
    select coalesce(max(
      (regexp_match(code, '^T(\d+)' || v_suffix || '$'))[1]::int
    ), 0) + 1
    into v_next
    from prosegur_responses
    where code ~ ('^T\d+' || v_suffix || '$');

    return 'T' || lpad(v_next::text, 2, '0') || v_suffix;
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

-- Crear postulante con flag de prueba
drop function if exists public.prosegur_admin_create_postulante(text, text, text, text, text);

create or replace function public.prosegur_admin_create_postulante(
  p_passcode text,
  p_nombre_apellido text,
  p_pais text,
  p_idioma text default 'es',
  p_reclutador text default null,
  p_is_prueba boolean default false
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
  v_code := public.prosegur_generate_code_for_country(p_pais, p_is_prueba);

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

  insert into prosegur_responses (
    id, code, nombre, apellido, nombre_apellido, idioma, answers, stages, is_prueba
  )
  values (
    v_code,
    v_code,
    v_nombre,
    nullif(v_apellido, ''),
    v_full_name,
    v_idioma,
    v_answers,
    '{}'::jsonb,
    coalesce(p_is_prueba, false)
  )
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'code', v_row.code,
    'accessToken', v_row.access_token,
    'idioma', v_row.idioma,
    'isPrueba', v_row.is_prueba,
    'nombre', v_row.nombre,
    'apellido', v_row.apellido,
    'nombreApellido', v_row.nombre_apellido,
    'answers', coalesce(v_row.answers, '{}'::jsonb),
    'stages', coalesce(v_row.stages, '{}'::jsonb),
    'createdAt', v_row.created_at
  );
end;
$$;

-- Detalle por token: incluir isPrueba
create or replace function public.prosegur_get_response_by_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.prosegur_responses%rowtype;
begin
  select * into v_row
  from prosegur_responses
  where access_token = p_token;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'code', v_row.code,
    'accessToken', v_row.access_token,
    'idioma', coalesce(v_row.idioma, 'es'),
    'isPrueba', coalesce(v_row.is_prueba, false),
    'nombre', v_row.nombre,
    'apellido', v_row.apellido,
    'nombreApellido', v_row.nombre_apellido,
    'empresa', v_row.empresa,
    'ciudad', v_row.ciudad,
    'fechaInicio', v_row.fecha_inicio,
    'fechaFin', v_row.fecha_fin,
    'ultimaEtapa', v_row.ultima_etapa,
    'status', v_row.status,
    'stages', coalesce(v_row.stages, '{}'::jsonb),
    'reviewFlags', coalesce(v_row.review_flags, '{}'::jsonb),
    'answers', coalesce(v_row.answers, '{}'::jsonb),
    'reviewedAt', v_row.reviewed_at,
    'reviewedBy', v_row.reviewed_by,
    'createdAt', v_row.created_at,
    'updatedAt', v_row.updated_at
  );
end;
$$;

-- Listado liviano: incluir isPrueba
create or replace function public.prosegur_admin_list_responses_summary(p_passcode text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.prosegur_validate_passcode(p_passcode) then
    raise exception 'Passcode inválido';
  end if;

  return (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', id,
        'code', code,
        'accessToken', access_token,
        'idioma', coalesce(idioma, 'es'),
        'isPrueba', coalesce(is_prueba, false),
        'nombre', nombre,
        'apellido', apellido,
        'nombreApellido', nombre_apellido,
        'empresa', empresa,
        'ciudad', ciudad,
        'fechaInicio', fecha_inicio,
        'fechaFin', fecha_fin,
        'ultimaEtapa', ultima_etapa,
        'status', status,
        'stages', coalesce(stages, '{}'::jsonb),
        'answers', public.prosegur_summary_answers(answers),
        'createdAt', created_at,
        'updatedAt', updated_at
      ) order by updated_at desc
    ), '[]'::jsonb)
    from prosegur_responses
  );
end;
$$;

-- Resultados públicos: excluir encuestas de prueba
create or replace function public.prosegur_get_public_results()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb := '[]'::jsonb;
  v_row record;
  v_max_stage text;
begin
  for v_row in
    select *
    from prosegur_responses
    where coalesce(is_prueba, false) = false
    order by updated_at desc
  loop
    v_max_stage := public.prosegur_max_approved_stage(v_row.stages);
    if v_max_stage is not null then
      v_result := v_result || jsonb_build_array(jsonb_build_object(
        'id', v_row.id,
        'code', v_row.code,
        'nombre', v_row.nombre,
        'apellido', v_row.apellido,
        'nombreApellido', v_row.nombre_apellido,
        'empresa', v_row.empresa,
        'ciudad', v_row.ciudad,
        'maxApprovedStage', v_max_stage,
        'stages', v_row.stages,
        'answers', v_row.answers,
        'updatedAt', v_row.updated_at
      ));
    end if;
  end loop;
  return v_result;
end;
$$;

grant execute on function public.prosegur_generate_code_for_country(text, boolean) to anon, authenticated;
grant execute on function public.prosegur_admin_create_postulante(text, text, text, text, text, boolean) to anon, authenticated;
