-- Incluir answers en el listado de postulantes (para país/marca en dashboard)
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
        'answers', coalesce(answers, '{}'::jsonb),
        'status', status,
        'createdAt', created_at,
        'updatedAt', updated_at
      ) order by created_at desc
    ), '[]'::jsonb)
    from prosegur_responses
  );
end;
$$;
