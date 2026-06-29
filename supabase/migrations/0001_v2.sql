-- ============================================================
-- Mystery Candidate v2 — modelo de datos
-- Ejecutar en el SQL Editor de Supabase (después de schema.sql)
-- ============================================================

-- Secuencia para códigos legibles MC-001, MC-002, ...
create sequence if not exists public.mystery_code_seq start 1;

-- Función que genera el próximo código legible
create or replace function public.generate_mystery_code()
returns text
language plpgsql
as $$
begin
  return 'MC-' || lpad(nextval('public.mystery_code_seq')::text, 3, '0');
end;
$$;

-- Nuevas columnas v2 (idempotente si ya existen)
alter table public.mystery_responses
  add column if not exists code text,
  add column if not exists access_token uuid default gen_random_uuid(),
  add column if not exists nombre text,
  add column if not exists apellido text,
  add column if not exists stages jsonb not null default '{}'::jsonb;

-- Backfill: filas existentes sin code → usar id anterior o generar uno
update public.mystery_responses
set code = id
where code is null and id is not null;

update public.mystery_responses
set code = public.generate_mystery_code()
where code is null;

update public.mystery_responses
set access_token = gen_random_uuid()
where access_token is null;

-- Backfill nombre/apellido desde nombre_apellido si existe
update public.mystery_responses
set nombre = split_part(nombre_apellido, ' ', 1),
    apellido = nullif(trim(substring(nombre_apellido from position(' ' in nombre_apellido) + 1)), '')
where nombre is null
  and nombre_apellido is not null
  and nombre_apellido <> '';

-- Restricciones e índices
alter table public.mystery_responses
  alter column code set not null,
  alter column access_token set not null;

create unique index if not exists mystery_responses_code_idx
  on public.mystery_responses (code);

create unique index if not exists mystery_responses_access_token_idx
  on public.mystery_responses (access_token);

create index if not exists mystery_responses_stages_idx
  on public.mystery_responses using gin (stages);

-- Default para nuevas filas
alter table public.mystery_responses
  alter column code set default public.generate_mystery_code();

-- Bucket evidencia: permitir archivos grandes y cualquier MIME
update storage.buckets
set
  file_size_limit = 5368709120,  -- 5 GB
  allowed_mime_types = null
where id = 'evidencia';
