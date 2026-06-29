-- ============================================================
-- Mystery Shopper Prosegur — esquema aislado (mismo Supabase)
-- Convive con mystery_responses / RPCs del Mystery Candidate.
-- Ejecutar completo en el SQL Editor del proyecto compartido.
-- ============================================================

create extension if not exists pgcrypto;

-- Secuencia para códigos legibles PS-001, PS-002, ...
create sequence if not exists public.prosegur_code_seq start 1;

create or replace function public.prosegur_generate_code()
returns text
language plpgsql
as $$
begin
  return 'PS-' || lpad(nextval('public.prosegur_code_seq')::text, 3, '0');
end;
$$;

-- Tabla principal (independiente de mystery_responses)
create table if not exists public.prosegur_responses (
  id              text primary key,
  code            text not null default public.prosegur_generate_code(),
  access_token    uuid not null default gen_random_uuid(),
  nombre          text,
  apellido        text,
  nombre_apellido text,
  empresa         text,
  ciudad          text,
  fecha_inicio    date,
  fecha_fin       date,
  ultima_etapa    text,
  status          text not null default 'borrador'
                  check (status in ('borrador','en_revision','publicado','rechazado')),
  stages          jsonb not null default '{}'::jsonb,
  answers         jsonb not null default '{}'::jsonb,
  reviewed_at     timestamptz,
  reviewed_by     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists prosegur_responses_code_idx
  on public.prosegur_responses (code);
create unique index if not exists prosegur_responses_access_token_idx
  on public.prosegur_responses (access_token);
create index if not exists prosegur_responses_status_idx
  on public.prosegur_responses (status);
create index if not exists prosegur_responses_stages_idx
  on public.prosegur_responses using gin (stages);

create or replace function public.prosegur_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists prosegur_responses_set_updated_at on public.prosegur_responses;
create trigger prosegur_responses_set_updated_at
  before update on public.prosegur_responses
  for each row execute function public.prosegur_set_updated_at();

-- Passcode Prosegur (clave distinta a passcode_hash del Mystery Candidate)
insert into public.app_config (key, value)
values (
  'prosegur_passcode_hash',
  crypt('operaciones123', gen_salt('bf'))
)
on conflict (key) do nothing;

alter table public.prosegur_responses enable row level security;

-- Bucket de evidencia propio (no toca el bucket "evidencia" del MC)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidencia-prosegur', 'evidencia-prosegur', true, 5368709120, null)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "prosegur evidencia lectura publica" on storage.objects;
create policy "prosegur evidencia lectura publica"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'evidencia-prosegur');

drop policy if exists "prosegur evidencia subida publica" on storage.objects;
create policy "prosegur evidencia subida publica"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'evidencia-prosegur');

-- ============================================================
-- Helpers internos (prefijo prosegur_)
-- ============================================================

create or replace function public.prosegur_validate_passcode(p_passcode text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
begin
  select value into v_hash from app_config where key = 'prosegur_passcode_hash';
  if v_hash is null then
    return false;
  end if;
  return v_hash = crypt(p_passcode, v_hash);
end;
$$;

-- Debe coincidir con lib/survey-config.ts
create or replace function public.prosegur_reviewable_sections()
returns text[]
language sql
immutable
as $$
  select array['ejemplo']::text[];
$$;

create or replace function public.prosegur_max_approved_stage(p_stages jsonb)
returns text
language plpgsql
immutable
as $$
declare
  v_order text[] := public.prosegur_reviewable_sections();
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

  if p_section_id <> 'general' and p_submit_for_review then
    v_stages := v_stages || jsonb_build_object(
      p_section_id,
      (coalesce(v_stages -> p_section_id, '{}'::jsonb) ||
        jsonb_build_object(
          'status', 'en_revision',
          'submittedAt', v_now
        )) - 'rejectionMessage'
    );
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

-- ============================================================
-- RPCs — Vista pública
-- ============================================================

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

-- ============================================================
-- RPCs — Admin (passcode)
-- ============================================================

create or replace function public.prosegur_admin_create_postulante(
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
  v_row public.prosegur_responses%rowtype;
  v_code text;
begin
  if not public.prosegur_validate_passcode(p_passcode) then
    raise exception 'Passcode inválido';
  end if;

  v_code := public.prosegur_generate_code();

  insert into prosegur_responses (id, code, nombre, apellido, nombre_apellido, answers, stages)
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

create or replace function public.prosegur_admin_review_stage(
  p_passcode text,
  p_response_id text,
  p_section_id text,
  p_action text,
  p_reviewed_by text default 'Ops',
  p_rejection_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.prosegur_responses%rowtype;
  v_stages jsonb;
  v_stage_patch jsonb;
  v_new_status text;
  v_now timestamptz := now();
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
    reviewed_at = v_now,
    reviewed_by = p_reviewed_by,
    updated_at = v_now
  where id = p_response_id
  returning * into v_row;

  return public.prosegur_get_response_by_token(v_row.access_token);
end;
$$;

create or replace function public.prosegur_admin_delete_postulante(
  p_passcode text,
  p_response_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.prosegur_validate_passcode(p_passcode) then
    raise exception 'Passcode inválido';
  end if;

  delete from prosegur_responses where id = p_response_id;

  if not found then
    raise exception 'Postulante no encontrado';
  end if;

  return true;
end;
$$;

create or replace function public.prosegur_admin_unlock_survey(
  p_passcode text,
  p_response_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.prosegur_responses%rowtype;
  v_answers jsonb;
  v_now timestamptz := now();
begin
  if not public.prosegur_validate_passcode(p_passcode) then
    raise exception 'Passcode inválido';
  end if;

  select * into v_row from prosegur_responses where id = p_response_id;
  if not found then
    raise exception 'Postulante no encontrado';
  end if;

  if coalesce(v_row.answers ->> 'proceso-finalizado', '') <> 'si' then
    raise exception 'El proceso no está finalizado';
  end if;

  v_answers := coalesce(v_row.answers, '{}'::jsonb) - 'proceso-finalizado';

  update prosegur_responses
  set
    answers = v_answers,
    updated_at = v_now
  where id = p_response_id
  returning * into v_row;

  return public.prosegur_get_response_by_token(v_row.access_token);
end;
$$;

create or replace function public.prosegur_admin_update_passcode(
  p_current_passcode text,
  p_new_passcode text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.prosegur_validate_passcode(p_current_passcode) then
    raise exception 'Passcode actual inválido';
  end if;

  update app_config
  set value = crypt(p_new_passcode, gen_salt('bf'))
  where key = 'prosegur_passcode_hash';

  return true;
end;
$$;

-- Grants para anon
grant execute on function public.prosegur_get_response_by_token(uuid) to anon, authenticated;
grant execute on function public.prosegur_save_stage_by_token(uuid, text, jsonb, boolean) to anon, authenticated;
grant execute on function public.prosegur_get_public_results() to anon, authenticated;
grant execute on function public.prosegur_admin_create_postulante(text, text, text) to anon, authenticated;
grant execute on function public.prosegur_admin_list_postulantes(text) to anon, authenticated;
grant execute on function public.prosegur_admin_get_responses(text) to anon, authenticated;
grant execute on function public.prosegur_admin_get_pending_reviews(text) to anon, authenticated;
grant execute on function public.prosegur_admin_review_stage(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.prosegur_admin_delete_postulante(text, text) to anon, authenticated;
grant execute on function public.prosegur_admin_unlock_survey(text, text) to anon, authenticated;
grant execute on function public.prosegur_admin_update_passcode(text, text) to anon, authenticated;
