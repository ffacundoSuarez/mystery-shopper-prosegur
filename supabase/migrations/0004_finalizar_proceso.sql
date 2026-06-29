-- ============================================================
-- Mystery Candidate — bloqueo al finalizar proceso
-- Reemplaza save_stage_by_token: rechaza envíos si ya finalizó.
-- No modifica tablas; solo la función RPC.
-- ============================================================

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

  -- Bloquear nuevos envíos una vez que el postulante marcó el proceso como finalizado
  if coalesce(v_row.answers ->> 'proceso-finalizado', '') = 'si' then
    raise exception 'El proceso ya fue finalizado';
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
