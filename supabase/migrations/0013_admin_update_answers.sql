-- Permite al admin editar respuestas sin cambiar el estado de las etapas

create or replace function public.prosegur_admin_update_answers(
  p_passcode text,
  p_response_id text,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.prosegur_responses%rowtype;
  v_merged jsonb;
  v_nombre text;
  v_apellido text;
  v_now timestamptz := now();
begin
  if not public.prosegur_validate_passcode(p_passcode) then
    raise exception 'Passcode inválido';
  end if;

  select * into v_row from prosegur_responses where id = p_response_id;
  if not found then
    raise exception 'Postulante no encontrado';
  end if;

  v_merged := coalesce(v_row.answers, '{}'::jsonb) || coalesce(p_answers, '{}'::jsonb);

  v_nombre := coalesce(v_row.nombre, v_merged ->> 'nombre-apellido');
  v_apellido := v_row.apellido;

  update prosegur_responses
  set
    answers = v_merged,
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
  where id = p_response_id
  returning * into v_row;

  return public.prosegur_get_response_by_token(v_row.access_token);
end;
$$;

grant execute on function public.prosegur_admin_update_answers(text, text, jsonb) to anon, authenticated;
