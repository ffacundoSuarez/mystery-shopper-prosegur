-- ============================================================
-- Mystery Candidate — desbloquear encuesta finalizada (admin)
-- Quita proceso-finalizado para que el postulante pueda editar de nuevo.
-- ============================================================

create or replace function public.admin_unlock_survey(
  p_passcode text,
  p_response_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.mystery_responses%rowtype;
  v_answers jsonb;
  v_now timestamptz := now();
begin
  if not public.validate_passcode(p_passcode) then
    raise exception 'Passcode inválido';
  end if;

  select * into v_row from mystery_responses where id = p_response_id;
  if not found then
    raise exception 'Postulante no encontrado';
  end if;

  if coalesce(v_row.answers ->> 'proceso-finalizado', '') <> 'si' then
    raise exception 'El proceso no está finalizado';
  end if;

  -- Quitar la marca de finalizado; se conserva fecha-fin por si Ops la necesita
  v_answers := coalesce(v_row.answers, '{}'::jsonb) - 'proceso-finalizado';

  update mystery_responses
  set
    answers = v_answers,
    updated_at = v_now
  where id = p_response_id
  returning * into v_row;

  return public.get_response_by_token(v_row.access_token);
end;
$$;

grant execute on function public.admin_unlock_survey(text, text) to anon, authenticated;
