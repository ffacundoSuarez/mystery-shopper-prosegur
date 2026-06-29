-- ============================================================
-- Mystery Candidate v2 — seguridad (RLS + RPCs)
-- Solo anon key. La autoridad viene de access_token o passcode.
-- ============================================================

create extension if not exists pgcrypto;

-- Tabla de configuración interna (passcode hasheado con pgcrypto)
create table if not exists public.app_config (
  key   text primary key,
  value text not null
);

-- Insertar passcode por defecto (cambiar en producción vía SQL):
-- hash de 'operaciones123' — reemplazar con: crypt('TU_PASSCODE', gen_salt('bf'))
insert into public.app_config (key, value)
values (
  'passcode_hash',
  crypt('operaciones123', gen_salt('bf'))
)
on conflict (key) do nothing;

alter table public.app_config enable row level security;
-- Sin policies: nadie accede directo a app_config (solo RPCs SECURITY DEFINER)

-- Cerrar acceso directo a mystery_responses
drop policy if exists "acceso publico mystery_responses" on public.mystery_responses;

-- ============================================================
-- Helpers internos
-- ============================================================

create or replace function public.validate_passcode(p_passcode text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
begin
  select value into v_hash from app_config where key = 'passcode_hash';
  if v_hash is null then
    return false;
  end if;
  return v_hash = crypt(p_passcode, v_hash);
end;
$$;

-- Secciones revisables (sin 'general')
create or replace function public.reviewable_sections()
returns text[]
language sql
immutable
as $$
  select array[
    'postulacion','primer-contacto','contacto-adicional','entrevista',
    'evaluacion','oferta','aceptacion','pre-onboarding','primer-dia','primera-semana'
  ]::text[];
$$;

-- Etapa máxima aprobada (para vista pública)
create or replace function public.max_approved_stage(p_stages jsonb)
returns text
language plpgsql
immutable
as $$
declare
  v_order text[] := public.reviewable_sections();
  v_stage text;
  v_status text;
  v_max text := null;
  v_idx int := 0;
  v_max_idx int := -1;
begin
  foreach v_stage in array v_order loop
    v_status := p_stages -> v_stage ->> 'status';
    if v_status = 'aprobada' then
      v_idx := array_position(v_order, v_stage);
      if v_idx > v_max_idx then
        v_max_idx := v_idx;
        v_max := v_stage;
      end if;
    end if;
  end loop;
  return v_max;
end;
$$;

-- ============================================================
-- RPCs — Postulante (access_token)
-- ============================================================

create or replace function public.get_response_by_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.mystery_responses%rowtype;
begin
  select * into v_row
  from mystery_responses
  where access_token = p_token;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'code', v_row.code,
    'accessToken', v_row.access_token,
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
    'answers', coalesce(v_row.answers, '{}'::jsonb),
    'reviewedAt', v_row.reviewed_at,
    'reviewedBy', v_row.reviewed_by,
    'createdAt', v_row.created_at,
    'updatedAt', v_row.updated_at
  );
end;
$$;

create or replace function public.save_stage_by_token(
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
  v_row public.mystery_responses%rowtype;
  v_stages jsonb;
  v_merged jsonb;
  v_now timestamptz := now();
  v_nombre text;
  v_apellido text;
begin
  select * into v_row from mystery_responses where access_token = p_token;
  if not found then
    raise exception 'Encuesta no encontrada';
  end if;

  v_merged := coalesce(v_row.answers, '{}'::jsonb) || coalesce(p_answers, '{}'::jsonb);
  v_stages := coalesce(v_row.stages, '{}'::jsonb);

  if p_section_id <> 'general' and p_submit_for_review then
    v_stages := v_stages || jsonb_build_object(
      p_section_id,
      jsonb_build_object(
        'status', 'en_revision',
        'submittedAt', v_now
      )
    );
  elsif p_section_id <> 'general' then
    -- Guardado parcial sin enviar a revisión
    v_stages := v_stages || jsonb_build_object(
      p_section_id,
      coalesce(v_stages -> p_section_id, '{}'::jsonb) ||
      jsonb_build_object('status', coalesce(v_stages -> p_section_id ->> 'status', 'pendiente'))
    );
  end if;

  v_nombre := coalesce(v_row.nombre, v_merged ->> 'nombre-apellido');
  v_apellido := v_row.apellido;

  update mystery_responses
  set
    answers = v_merged,
    stages = v_stages,
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

  return public.get_response_by_token(p_token);
end;
$$;

-- ============================================================
-- RPCs — Vista pública (resultados aprobados por etapa)
-- ============================================================

create or replace function public.get_public_results()
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
    from mystery_responses
    order by updated_at desc
  loop
    v_max_stage := public.max_approved_stage(v_row.stages);
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

-- ============================================================
-- RPCs — Admin (passcode)
-- ============================================================

create or replace function public.admin_create_postulante(
  p_passcode text,
  p_nombre text,
  p_apellido text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.mystery_responses%rowtype;
  v_code text;
begin
  if not public.validate_passcode(p_passcode) then
    raise exception 'Passcode inválido';
  end if;

  v_code := public.generate_mystery_code();

  insert into mystery_responses (id, code, nombre, apellido, nombre_apellido, answers, stages)
  values (
    v_code,
    v_code,
    p_nombre,
    p_apellido,
    trim(p_nombre || ' ' || p_apellido),
    jsonb_build_object('nombre-apellido', trim(p_nombre || ' ' || p_apellido)),
    '{}'::jsonb
  )
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'code', v_row.code,
    'accessToken', v_row.access_token,
    'nombre', v_row.nombre,
    'apellido', v_row.apellido,
    'createdAt', v_row.created_at
  );
end;
$$;

create or replace function public.admin_list_postulantes(p_passcode text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.validate_passcode(p_passcode) then
    raise exception 'Passcode inválido';
  end if;

  return (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', id,
        'code', code,
        'accessToken', access_token,
        'nombre', nombre,
        'apellido', apellido,
        'nombreApellido', nombre_apellido,
        'empresa', empresa,
        'ciudad', ciudad,
        'stages', coalesce(stages, '{}'::jsonb),
        'status', status,
        'createdAt', created_at,
        'updatedAt', updated_at
      ) order by created_at desc
    ), '[]'::jsonb)
    from mystery_responses
  );
end;
$$;

create or replace function public.admin_get_responses(p_passcode text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.validate_passcode(p_passcode) then
    raise exception 'Passcode inválido';
  end if;

  return (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', id,
        'code', code,
        'accessToken', access_token,
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
        'answers', coalesce(answers, '{}'::jsonb),
        'reviewedAt', reviewed_at,
        'reviewedBy', reviewed_by,
        'createdAt', created_at,
        'updatedAt', updated_at
      ) order by updated_at desc
    ), '[]'::jsonb)
    from mystery_responses
  );
end;
$$;

create or replace function public.admin_get_pending_reviews(p_passcode text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb := '[]'::jsonb;
  v_row record;
  v_section text;
  v_sections text[] := public.reviewable_sections();
begin
  if not public.validate_passcode(p_passcode) then
    raise exception 'Passcode inválido';
  end if;

  for v_row in select * from mystery_responses order by updated_at desc loop
    foreach v_section in array v_sections loop
      if (v_row.stages -> v_section ->> 'status') = 'en_revision' then
        v_result := v_result || jsonb_build_array(jsonb_build_object(
          'id', v_row.id,
          'code', v_row.code,
          'accessToken', v_row.access_token,
          'nombre', v_row.nombre,
          'apellido', v_row.apellido,
          'nombreApellido', v_row.nombre_apellido,
          'empresa', v_row.empresa,
          'ciudad', v_row.ciudad,
          'sectionId', v_section,
          'stages', coalesce(v_row.stages, '{}'::jsonb),
          'answers', coalesce(v_row.answers, '{}'::jsonb),
          'updatedAt', v_row.updated_at
        ));
      end if;
    end loop;
  end loop;

  return v_result;
end;
$$;

create or replace function public.admin_review_stage(
  p_passcode text,
  p_response_id text,
  p_section_id text,
  p_action text,
  p_reviewed_by text default 'Ops'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.mystery_responses%rowtype;
  v_stages jsonb;
  v_new_status text;
  v_now timestamptz := now();
begin
  if not public.validate_passcode(p_passcode) then
    raise exception 'Passcode inválido';
  end if;

  if p_action not in ('aprobar', 'rechazar') then
    raise exception 'Acción inválida';
  end if;

  v_new_status := case when p_action = 'aprobar' then 'aprobada' else 'rechazada' end;

  select * into v_row from mystery_responses where id = p_response_id;
  if not found then
    raise exception 'Postulante no encontrado';
  end if;

  v_stages := coalesce(v_row.stages, '{}'::jsonb);
  v_stages := jsonb_set(
    v_stages,
    array[p_section_id],
    coalesce(v_stages -> p_section_id, '{}'::jsonb) ||
    jsonb_build_object(
      'status', v_new_status,
      'reviewedAt', v_now,
      'reviewedBy', p_reviewed_by
    ),
    true
  );

  update mystery_responses
  set
    stages = v_stages,
    reviewed_at = v_now,
    reviewed_by = p_reviewed_by,
    updated_at = v_now
  where id = p_response_id
  returning * into v_row;

  return public.get_response_by_token(v_row.access_token);
end;
$$;

create or replace function public.admin_update_passcode(
  p_current_passcode text,
  p_new_passcode text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.validate_passcode(p_current_passcode) then
    raise exception 'Passcode actual inválido';
  end if;

  update app_config
  set value = crypt(p_new_passcode, gen_salt('bf'))
  where key = 'passcode_hash';

  return true;
end;
$$;

-- Grants para anon (todas las operaciones van por RPC)
grant execute on function public.get_response_by_token(uuid) to anon, authenticated;
grant execute on function public.save_stage_by_token(uuid, text, jsonb, boolean) to anon, authenticated;
grant execute on function public.get_public_results() to anon, authenticated;
grant execute on function public.admin_create_postulante(text, text, text) to anon, authenticated;
grant execute on function public.admin_list_postulantes(text) to anon, authenticated;
grant execute on function public.admin_get_responses(text) to anon, authenticated;
grant execute on function public.admin_get_pending_reviews(text) to anon, authenticated;
grant execute on function public.admin_review_stage(text, text, text, text, text) to anon, authenticated;
grant execute on function public.admin_update_passcode(text, text) to anon, authenticated;
