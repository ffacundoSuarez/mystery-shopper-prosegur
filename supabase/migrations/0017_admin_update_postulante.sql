-- ============================================================
-- Editar datos de postulante (nombre/apellido + reclutador)
-- No toca país, idioma, is_prueba ni el ID/código.
-- ============================================================

create or replace function public.prosegur_admin_update_postulante(
  p_passcode text,
  p_response_id text,
  p_nombre_apellido text,
  p_reclutador text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.prosegur_responses%rowtype;
  v_full_name text;
  v_nombre text;
  v_apellido text;
  v_space int;
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

  v_full_name := trim(coalesce(p_nombre_apellido, ''));
  if v_full_name = '' then
    raise exception 'Nombre y apellido requerido';
  end if;

  -- Partir nombre / apellido igual que en create
  v_space := position(' ' in v_full_name);
  if v_space > 0 then
    v_nombre := left(v_full_name, v_space - 1);
    v_apellido := trim(substring(v_full_name from v_space + 1));
  else
    v_nombre := v_full_name;
    v_apellido := '';
  end if;

  v_answers := coalesce(v_row.answers, '{}'::jsonb)
    || jsonb_build_object('nombre-apellido', v_full_name);

  -- Si reclutador viene vacío, quitar la clave; si no, setearla
  if nullif(trim(coalesce(p_reclutador, '')), '') is null then
    v_answers := v_answers - 'reclutador';
  else
    v_answers := v_answers || jsonb_build_object('reclutador', trim(p_reclutador));
  end if;

  update prosegur_responses
  set
    nombre = v_nombre,
    apellido = nullif(v_apellido, ''),
    nombre_apellido = v_full_name,
    answers = v_answers,
    updated_at = v_now
  where id = p_response_id
  returning * into v_row;

  return public.prosegur_get_response_by_token(v_row.access_token);
end;
$$;

grant execute on function public.prosegur_admin_update_postulante(text, text, text, text) to anon, authenticated;
