-- Marcar review_flags como corregidas al reenviar (en vez de borrarlas)

create or replace function public.prosegur_mark_review_flags_corrected(
  p_flags jsonb,
  p_section_id text,
  p_corrected_at timestamptz
)
returns jsonb
language plpgsql
stable
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
    if coalesce(v_entry ->> 'sectionId', '') = p_section_id then
      v_result := v_result || jsonb_build_object(
        v_key,
        v_entry || jsonb_build_object(
          'corrected', true,
          'correctedAt', to_jsonb(p_corrected_at::text)
        )
      );
    else
      v_result := v_result || jsonb_build_object(v_key, v_entry);
    end if;
  end loop;

  return v_result;
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
    -- Al reenviar correcciones, marcar flags de esta sección como corregidas
    v_flags := public.prosegur_mark_review_flags_corrected(v_flags, p_section_id, v_now);
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
    -- Descartar flags ya corregidas de esta sección antes de mergear nuevas
    v_flags := public.prosegur_clear_review_flags_for_section(v_flags, p_section_id);
    for v_key, v_entry in select * from jsonb_each(p_review_flags) loop
      v_flags := v_flags || jsonb_build_object(v_key, v_entry);
    end loop;
  elsif p_action = 'aprobar' then
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

grant execute on function public.prosegur_mark_review_flags_corrected(jsonb, text, timestamptz) to anon, authenticated;
grant execute on function public.prosegur_save_stage_by_token(uuid, text, jsonb, boolean) to anon, authenticated;
grant execute on function public.prosegur_admin_review_stage(text, text, text, text, text, text, jsonb) to anon, authenticated;
