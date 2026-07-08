-- Listado liviano para el panel admin: stages + claves de screening en answers.
-- Evita transferir evidencias, matrices y textos largos en listados de 200+ filas.

-- Extrae solo las claves de answers usadas por listados, filtros y progreso.
create or replace function public.prosegur_summary_answers(p_answers jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    (
      select jsonb_object_agg(key, value)
      from jsonb_each(coalesce(p_answers, '{}'::jsonb))
      where key in (
        'f1-pais',
        'f2a-region', 'f2b-region', 'f2c-region', 'f2d-region',
        'f2e-region', 'f2f-region', 'f2g-region', 'f2h-region',
        'f3-marca', 'f3-marca-otra', 'f4-categoria', 'f5-canal',
        'reclutador', 'ultima-etapa'
      )
    ),
    '{}'::jsonb
  );
$$;

create or replace function public.prosegur_admin_list_responses_summary(p_passcode text)
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
        'idioma', coalesce(idioma, 'es'),
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
        'answers', public.prosegur_summary_answers(answers),
        'createdAt', created_at,
        'updatedAt', updated_at
      ) order by updated_at desc
    ), '[]'::jsonb)
    from prosegur_responses
  );
end;
$$;

grant execute on function public.prosegur_summary_answers(jsonb) to anon, authenticated;
grant execute on function public.prosegur_admin_list_responses_summary(text) to anon, authenticated;
