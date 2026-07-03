-- Revisión por pregunta (review_flags) + idioma del cuestionario

alter table public.prosegur_responses
  add column if not exists review_flags jsonb not null default '{}'::jsonb,
  add column if not exists idioma text not null default 'es'
    check (idioma in ('es', 'pt'));

-- ============================================================
-- Helpers
-- ============================================================

-- Quita del mapa las flags de una sección (al reenviar correcciones)
create or replace function public.prosegur_clear_review_flags_for_section(
  p_flags jsonb,
  p_section_id text
)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_key text;
  v_result jsonb := '{}'::jsonb;
  v_entry jsonb;
begin
  if p_flags is null or p_flags = '{}'::jsonb then
    return '{}'::jsonb;
  end if;

  for v_key, v_entry in select * from jsonb_each(p_flags) loop
    if coalesce(v_entry ->> 'sectionId', '') <> p_section_id then
      v_result := v_result || jsonb_build_object(v_key, v_entry);
    end if;
  end loop;

  return v_result;
end;
$$;

-- ============================================================
-- RPCs actualizados
-- ============================================================

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

create or replace function public.prosegur_save_stage_by_token(
  p_token uuid,
  p_section_id text,
  p_answers jsonb,
  p_submit_for_review boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.prosegur_responses%rowtype;
  v_stages jsonb;
  v_merged jsonb;
  v_flags jsonb;
  v_now timestamptz := now();
  v_nombre text;
  v_apellido text;
begin
  select * into v_row from prosegur_responses where access_token = p_token;
  if not found then
    raise exception 'Encuesta no encontrada';
  end if;

  if coalesce(v_row.answers ->> 'proceso-finalizado', '') = 'si' then
    raise exception 'El proceso ya fue finalizado';
  end if;

  v_merged := coalesce(v_row.answers, '{}'::jsonb) || coalesce(p_answers, '{}'::jsonb);
  v_stages := coalesce(v_row.stages, '{}'::jsonb);
  v_flags := coalesce(v_row.review_flags, '{}'::jsonb);

  if p_section_id <> 'general' and p_submit_for_review then
    v_stages := v_stages || jsonb_build_object(
      p_section_id,
      (coalesce(v_stages -> p_section_id, '{}'::jsonb) ||
        jsonb_build_object(
          'status', 'en_revision',
          'submittedAt', v_now
        )) - 'rejectionMessage'
    );
    -- Al reenviar correcciones, limpiar flags de esta sección
    v_flags := public.prosegur_clear_review_flags_for_section(v_flags, p_section_id);
  elsif p_section_id <> 'general' then
    v_stages := v_stages || jsonb_build_object(
      p_section_id,
      coalesce(v_stages -> p_section_id, '{}'::jsonb) ||
      jsonb_build_object('status', coalesce(v_stages -> p_section_id ->> 'status', 'pendiente'))
    );
  end if;

  v_nombre := coalesce(v_row.nombre, v_merged ->> 'nombre-apellido');
  v_apellido := v_row.apellido;

  update prosegur_responses
  set
    answers = v_merged,
    stages = v_stages,
    review_flags = v_flags,
    nombre_apellido = coalesce(
      nullif(trim(coalesce(v_nombre, '') || ' ' || coalesce(v_apellido, '')), ''),
      v_merged ->> 'nombre-apellido',
      nombre_apellido
    ),
    empresa = coalesce(nullif(v_merged ->> 'empresa', ''), empresa),
    ciudad = coalesce(nullif(v_merged ->> 'ciudad', ''), ciudad),
    fecha_inicio = coalesce((v_merged ->> 'fecha-inicio')::date, fecha_inicio),
    fecha_fin = coalesce((v_merged ->> 'fecha-fin')::date, fecha_fin),
    ultima_etapa = coalesce(nullif(v_merged ->> 'ultima-etapa', ''), ultima_etapa),
    updated_at = v_now
  where access_token = p_token
  returning * into v_row;

  return public.prosegur_get_response_by_token(p_token);
end;
$$;

create or replace function public.prosegur_admin_create_postulante(
  p_passcode text,
  p_nombre text,
  p_apellido text,
  p_idioma text default 'es'
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
begin
  if not public.prosegur_validate_passcode(p_passcode) then
    raise exception 'Passcode inválido';
  end if;

  v_idioma := case when p_idioma = 'pt' then 'pt' else 'es' end;
  v_code := public.prosegur_generate_code();

  insert into prosegur_responses (id, code, nombre, apellido, nombre_apellido, idioma, answers, stages)
  values (
    v_code,
    v_code,
    p_nombre,
    p_apellido,
    trim(p_nombre || ' ' || p_apellido),
    v_idioma,
    jsonb_build_object('nombre-apellido', trim(p_nombre || ' ' || p_apellido)),
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
    'createdAt', v_row.created_at
  );
end;
$$;

create or replace function public.prosegur_admin_list_postulantes(p_passcode text)
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
        'nombre', nombre,
        'apellido', apellido,
        'nombreApellido', nombre_apellido,
        'empresa', empresa,
        'ciudad', ciudad,
        'stages', coalesce(stages, '{}'::jsonb),
        'reviewFlags', coalesce(review_flags, '{}'::jsonb),
        'answers', coalesce(answers, '{}'::jsonb),
        'status', status,
        'createdAt', created_at,
        'updatedAt', updated_at
      ) order by created_at desc
    ), '[]'::jsonb)
    from prosegur_responses
  );
end;
$$;

create or replace function public.prosegur_admin_get_responses(p_passcode text)
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
        'reviewFlags', coalesce(review_flags, '{}'::jsonb),
        'answers', coalesce(answers, '{}'::jsonb),
        'reviewedAt', reviewed_at,
        'reviewedBy', reviewed_by,
        'createdAt', created_at,
        'updatedAt', updated_at
      ) order by updated_at desc
    ), '[]'::jsonb)
    from prosegur_responses
  );
end;
$$;

create or replace function public.prosegur_admin_get_pending_reviews(p_passcode text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb := '[]'::jsonb;
  v_row record;
  v_section text;
  v_sections text[] := public.prosegur_reviewable_sections();
begin
  if not public.prosegur_validate_passcode(p_passcode) then
    raise exception 'Passcode inválido';
  end if;

  for v_row in select * from prosegur_responses order by updated_at desc loop
    foreach v_section in array v_sections loop
      if (v_row.stages -> v_section ->> 'status') = 'en_revision' then
        v_result := v_result || jsonb_build_array(jsonb_build_object(
          'id', v_row.id,
          'code', v_row.code,
          'accessToken', v_row.access_token,
          'idioma', coalesce(v_row.idioma, 'es'),
          'nombre', v_row.nombre,
          'apellido', v_row.apellido,
          'nombreApellido', v_row.nombre_apellido,
          'empresa', v_row.empresa,
          'ciudad', v_row.ciudad,
          'sectionId', v_section,
          'stages', coalesce(v_row.stages, '{}'::jsonb),
          'reviewFlags', coalesce(v_row.review_flags, '{}'::jsonb),
          'answers', coalesce(v_row.answers, '{}'::jsonb),
          'updatedAt', v_row.updated_at
        ));
      end if;
    end loop;
  end loop;

  return v_result;
end;
$$;

create or replace function public.prosegur_admin_review_stage(
  p_passcode text,
  p_response_id text,
  p_section_id text,
  p_action text,
  p_reviewed_by text default 'Ops',
  p_rejection_message text default null,
  p_review_flags jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.prosegur_responses%rowtype;
  v_stages jsonb;
  v_flags jsonb;
  v_stage_patch jsonb;
  v_new_status text;
  v_now timestamptz := now();
  v_key text;
  v_entry jsonb;
begin
  if not public.prosegur_validate_passcode(p_passcode) then
    raise exception 'Passcode inválido';
  end if;

  if p_action not in ('aprobar', 'rechazar') then
    raise exception 'Acción inválida';
  end if;

  v_new_status := case when p_action = 'aprobar' then 'aprobada' else 'rechazada' end;

  select * into v_row from prosegur_responses where id = p_response_id;
  if not found then
    raise exception 'Postulante no encontrado';
  end if;

  v_flags := coalesce(v_row.review_flags, '{}'::jsonb);

  if p_action = 'rechazar' and p_review_flags is not null and p_review_flags <> '{}'::jsonb then
    -- Mergear flags nuevas de esta revisión
    for v_key, v_entry in select * from jsonb_each(p_review_flags) loop
      v_flags := v_flags || jsonb_build_object(v_key, v_entry);
    end loop;
  elsif p_action = 'aprobar' then
    -- Al aprobar, limpiar flags de esta sección
    v_flags := public.prosegur_clear_review_flags_for_section(v_flags, p_section_id);
  end if;

  v_stage_patch := jsonb_build_object(
    'status', v_new_status,
    'reviewedAt', v_now,
    'reviewedBy', p_reviewed_by
  );

  if p_action = 'rechazar' and nullif(trim(p_rejection_message), '') is not null then
    v_stage_patch := v_stage_patch || jsonb_build_object(
      'rejectionMessage', trim(p_rejection_message)
    );
  end if;

  v_stages := coalesce(v_row.stages, '{}'::jsonb);
  v_stages := jsonb_set(
    v_stages,
    array[p_section_id],
    case
      when p_action = 'aprobar' then
        (coalesce(v_stages -> p_section_id, '{}'::jsonb) || v_stage_patch) - 'rejectionMessage'
      when nullif(trim(p_rejection_message), '') is null then
        (coalesce(v_stages -> p_section_id, '{}'::jsonb) || v_stage_patch) - 'rejectionMessage'
      else
        coalesce(v_stages -> p_section_id, '{}'::jsonb) || v_stage_patch
    end,
    true
  );

  update prosegur_responses
  set
    stages = v_stages,
    review_flags = v_flags,
    reviewed_at = v_now,
    reviewed_by = p_reviewed_by,
    updated_at = v_now
  where id = p_response_id
  returning * into v_row;

  return public.prosegur_get_response_by_token(v_row.access_token);
end;
$$;

-- Grants actualizados
grant execute on function public.prosegur_clear_review_flags_for_section(jsonb, text) to anon, authenticated;
grant execute on function public.prosegur_admin_create_postulante(text, text, text, text) to anon, authenticated;
grant execute on function public.prosegur_admin_review_stage(text, text, text, text, text, text, jsonb) to anon, authenticated;
