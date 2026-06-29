# Mystery Shopper Prosegur

Dashboard de encuestas Mystery Shopper para Prosegur. Base copiada de `mystery-shopper-dashboard` y adaptada con branding Prosegur.

## Stack

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui
- Supabase (PostgreSQL + Storage)

## Getting Started

1. Copiar variables de entorno:

```bash
cp .env.example .env.local
```

2. Completar `.env.local` con las credenciales del proyecto Supabase de Prosegur.

3. Ejecutar el SQL de `supabase/schema.sql` en el SQL Editor de Supabase.
   - Diseñado para convivir en el **mismo proyecto** que Mystery Candidate.
   - Crea tabla `prosegur_responses`, RPCs `prosegur_*` y bucket `evidencia-prosegur`.
   - **No modifica** `mystery_responses` ni las funciones del MC.

4. Instalar dependencias y levantar:

```bash
npm install
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Rutas principales

| Ruta | Descripción |
|------|-------------|
| `/acceso` | Login interno (passcode Ops) |
| `/dashboard` | Panel de control |
| `/dashboard/postulantes` | Crear postulantes y generar links |
| `/dashboard/revision` | Revisar etapas enviadas |
| `/dashboard/estadisticas` | Estadísticas generales |
| `/encuesta/[token]` | Encuesta del mystery shopper |
| `/resultados` | Vista pública para el cliente |

## Encuesta

La definición de la encuesta vive en `lib/survey-config.ts`. Soporta saltos lógicos con `showIf` (mostrar/ocultar preguntas según respuestas previas).
