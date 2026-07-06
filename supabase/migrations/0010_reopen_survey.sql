-- ============================================================
-- Reabrir cuestionario desde admin (postulantes)
-- Quita proceso-finalizado y encuesta-cerrada sin exigir estado finalizado.
-- ============================================================

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

  -- Quitar marcas de cierre; se conserva fecha-fin por si Ops la necesita
  v_answers := coalesce(v_row.answers, '{}'::jsonb)
    - 'proceso-finalizado'
    - 'encuesta-cerrada';

  update prosegur_responses
  set
    answers = v_answers,
    updated_at = v_now
  where id = p_response_id
  returning * into v_row;

  return public.prosegur_get_response_by_token(v_row.access_token);
end;
$$;

grant execute on function public.prosegur_admin_unlock_survey(text, text) to anon, authenticated;
