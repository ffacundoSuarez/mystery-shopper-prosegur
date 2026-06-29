# Guía: cómo arrancar el Mystery Shopper de PROSEGUR usando este proyecto como base

> Documento de recomendación. No ejecuta nada — explica **qué conviene** y **cómo
> hacerlo** cuando decidas arrancar.

## TL;DR — Qué conviene

**Opción (a): copiar este proyecto como base de un repo nuevo, y *después* usar un
agente para adaptar lo específico de Prosegur.**

Es la combinación de lo mejor de tus opciones (a) y (b):
- Reutilizás todo lo que ya funciona (no reescribís a mano, no empezás de cero).
- El agente entra *después*, para adaptar el dominio, no para "ir copiando de a poco".

### Por qué NO empezar de 0 (opción c)
Este proyecto ya tiene resuelta toda la "plomería" que es idéntica para Prosegur y
que tardarías días en rehacer:
- Stack completo: **Next.js 16 + React 19 + TypeScript**, **Tailwind v4 + shadcn/ui**.
- **Auth + base de datos con Supabase** (`middleware.ts`, `lib/`, `supabase/`).
- **Subida de archivos** (`tus-js-client`), **export a PDF** (`jspdf`) y **Excel** (`xlsx`).
- **UI ya armada**: componentes Radix, gráficos con `recharts`, toasts, etc.

Que sea "un poco más complejo" no es razón para empezar de cero: es razón para
partir de una base sólida y sumarle lo nuevo encima.

### Por qué NO la opción (b) tal cual
Que un agente "lea y vaya copiando" archivo por archivo es lento, propenso a errores
y deja piezas inconsistentes (el agente tiende a reescribir en vez de reutilizar).
Conviene **copiar el código tal cual** y recién después usar un agente para adaptarlo.
Lo bueno de (b) viene *después* de (a), no en lugar de ella.

---

## Lo más importante: qué NO copiar

Si copiás todo a lo bruto, el dashboard de Prosegur podría terminar escribiendo
sobre la base de datos del cliente actual. Estos elementos **no se copian**:

| Elemento        | Por qué no                                                        |
|-----------------|-------------------------------------------------------------------|
| `.env.local`    | Secretos del cliente actual → Prosegur necesita su propio Supabase |
| `.git/`         | Historia vieja → el repo nuevo arranca con historia limpia         |
| `node_modules/` | Se regenera con `npm install`                                      |
| `.next/`        | Se regenera con `npm run build` / `npm run dev`                    |
| `incoming/`     | Contexto del cliente actual (planilla Excel propia)               |

> `.env*` e `incoming/` ya están en `.gitignore`, así que aunque queden en disco no
> se suben al repo. Igual conviene no copiarlos para evitar confusiones.

**Sí copiar** `.env.example` (sirve de plantilla para el `.env.local` nuevo).

---

## Cómo hacerlo — paso a paso

Carpeta destino sugerida: `D:\Github\mystery-shopper-prosegur`

### 1. Crear la carpeta y copiar el código (sin lo de arriba)
Desde PowerShell, parado en `D:\Github`:

```powershell
# Crear carpeta destino
New-Item -ItemType Directory mystery-shopper-prosegur

# Copiar todo excepto lo que no se debe arrastrar
robocopy mystery-shopper-dashboard mystery-shopper-prosegur /E `
  /XD .git node_modules .next incoming `
  /XF .env.local
```

`robocopy` con `/XD` (excluir carpetas) y `/XF` (excluir archivos) deja todo lo
útil y descarta lo que no.

### 2. Git limpio + repo nuevo en GitHub
```powershell
cd D:\Github\mystery-shopper-prosegur
git init
git add .
git commit -m "Base copiada de mystery-shopper"

# Crear el repo en GitHub y subir (requiere gh CLI logueado)
gh repo create mystery-shopper-prosegur --private --source . --push
```

### 3. Renombrar el proyecto
- `package.json` → cambiar `"name": "mystery-shopper"` por
  `"name": "mystery-shopper-prosegur"`.
- Actualizar `README.md` con el nombre/branding de Prosegur.

### 4. Crear el `.env.local` nuevo (en blanco hasta tener el Supabase)
```powershell
Copy-Item .env.example .env.local
```

### 5. Instalar dependencias
```powershell
npm install
```

### 6. Crear el proyecto de Supabase de Prosegur
1. Crear un **proyecto nuevo** en https://supabase.com (separado del actual).
2. Copiar **Project URL** y **anon key** (Project Settings → API) en `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<proyecto-prosegur>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-de-prosegur>
   ```
3. Aplicar como punto de partida el esquema existente. Está en:
   - `supabase/migrations/0001_v2.sql` … `0006_rejection_message.sql`
   - o `supabase/schema.sql`

   Se puede correr el SQL desde el editor SQL del dashboard de Supabase, o con la
   Supabase CLI (`supabase db push`).

### 7. Probar que levanta
```powershell
npm run dev      # levanta el dashboard en local
npm run build    # confirma que compila sin errores
```
Verificá que el login funcione contra el **Supabase nuevo** (no el del cliente actual).

---

## Después: adaptar lo específico de Prosegur (con un agente)

Una vez con la base corriendo, recién ahí conviene usar un agente para adaptar el
dominio. Áreas a tocar (según los requisitos reales de Prosegur):

- **Esquema / encuesta** → nuevas migraciones en `supabase/` para el formulario y
  los campos propios de Prosegur (acá es donde entra "lo más complejo").
- **Lógica de negocio y UI** → `app/`, `components/`, `lib/`: branding, flujos,
  preguntas, validaciones.
- **Plantilla de datos** → el equivalente a la planilla de `incoming/`, pero de Prosegur.

> Consejo: conseguí primero los **requisitos concretos** de qué tiene que hacer el
> mystery de Prosegur (qué lo hace "más complejo"). El arranque (pasos 1–7) lo podés
> hacer ya; la adaptación rinde mucho más con los requisitos en mano.

---

## Resumen de la decisión

| Opción                         | Veredicto                                        |
|--------------------------------|--------------------------------------------------|
| (a) Copiar este como base      | ✅ **Recomendada** (+ agente para adaptar después) |
| (b) Agente que va copiando     | ❌ Lento e inconsistente como método principal     |
| (c) Empezar de 0               | ❌ Tirás semanas de plomería ya resuelta           |
