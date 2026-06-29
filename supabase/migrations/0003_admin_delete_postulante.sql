-- Eliminar postulante (registro + link deja de funcionar)
create or replace function public.admin_delete_postulante(
  p_passcode text,
  p_response_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.validate_passcode(p_passcode) then
    raise exception 'Passcode inválido';
  end if;

  delete from mystery_responses where id = p_response_id;

  if not found then
    raise exception 'Postulante no encontrado';
  end if;

  return true;
end;
$$;

grant execute on function public.admin_delete_postulante(text, text) to anon, authenticated;
