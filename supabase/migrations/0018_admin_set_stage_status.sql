-- ============================================================
-- Permitir que Ops cambie el estado de una etapa a en_revision
-- (además de aprobar / rechazar), p. ej. reabrir una aprobada.
-- ============================================================

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

  if p_action not in ('aprobar', 'rechazar', 'en_revision') then
    raise exception 'Acción inválida';
  end if;

  v_new_status := case p_action
    when 'aprobar' then 'aprobada'
    when 'rechazar' then 'rechazada'
    else 'en_revision'
  end;

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
  -- en_revision: no borrar flags existentes (Ops puede retomar correcciones)

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
      when p_action = 'en_revision' then
        -- Reabrir: limpia mensaje de rechazo; conserva flags de revisión
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

grant execute on function public.prosegur_admin_review_stage(text, text, text, text, text, text, jsonb) to anon, authenticated;
