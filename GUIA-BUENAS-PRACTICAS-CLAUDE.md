# Buenas prácticas para trabajar con Claude (guía para arrancar)

> Pensada para alguien nuevo. La idea es que, usando el agente de IA, puedas hacer
> las cosas de forma eficiente y sin romper nada, aunque no seas experto.
> Leéla una vez entera; después usala como checklist.

---

## La regla de oro

**No le pidas al agente "hacé todo" de una.** El agente es muy capaz, pero si le das
una orden gigante y vaga, va a asumir cosas y se puede equivocar. El secreto es:
**planear primero, ejecutar en pasos chicos, y revisar.**

El ciclo ideal es siempre:

1. **Planear** → 2. **Preguntar dudas** → 3. **Ejecutar de a poco** →
4. **Probar/testear** → 5. **Guardar lo aprendido** → 6. **Guardar en GitHub**

---

## 1. Primero planear (nunca tirar código a ciegas)

Antes de tocar código, pedile al agente un **plan**. Claude tiene un "modo plan"
(podés activarlo) donde te dice qué va a hacer **antes** de hacerlo, y vos lo aprobás.

Frases que funcionan:
- *"Antes de programar nada, hacé un plan paso a paso y mostrámelo para aprobarlo."*
- *"No escribas código todavía. Explicame qué archivos vas a tocar y por qué."*
- *"Guardá el plan en un archivo `.md` así no lo perdemos."*

**Por qué:** un plan escrito te deja ver si el agente entendió bien, antes de que
haga cambios difíciles de revertir.

---

## 2. Pedirle que haga preguntas

El agente, si no sabe algo, tiende a **adivinar**. Mejor que pregunte.

Frases que funcionan:
- *"Si algo no está claro, preguntame antes de avanzar. No asumas."*
- *"¿Qué dudas tenés sobre lo que te pedí?"*
- *"Hacé todas las preguntas que necesites antes de empezar."*

**Por qué:** una pregunta a tiempo evita una hora de trabajo en la dirección equivocada.

---

## 3. Preguntar por seguridad (huecos / vulnerabilidades)

No hace falta ser experto en seguridad: alcanza con **pedirle al agente que revise**.

Frases que funcionan:
- *"Revisá este código y decime si hay algún hueco de seguridad."*
- *"¿Hay datos sensibles (claves, contraseñas) expuestos en el código?"*
- *"¿Esto valida bien lo que sube el usuario? ¿Se puede colar algo malicioso?"*
- *"Hacé una revisión de seguridad antes de subir esto."*

**Cosas típicas que conviene revisar:**
- Que las **claves/secretos** no estén escritas dentro del código.
- Que los formularios **validen** lo que el usuario carga.
- Que la base de datos no quede abierta para que cualquiera lea/escriba.

---

## 4. Probar y testear (no confiar a ciegas)

Que el agente diga "listo" **no significa** que funcione. Siempre probá.

Frases que funcionan:
- *"Probá que esto funcione realmente, no solo que compile."*
- *"Levantá la app y verificá que el cambio anda."* (`npm run dev`)
- *"Corré el build para confirmar que no rompiste nada."* (`npm run build`)
- *"Escribí un test para esta función y corrélo."*

**Por qué:** los errores se encuentran probando, no leyendo. Mejor que el agente
los encuentre y los arregle antes de que lo veas vos (o el cliente).

---

## 5. Guardar la memoria (que no nos olvidemos qué hicimos)

Este es clave y muy fácil de olvidar. Pedile al agente que **deje registro escrito**
de lo importante, en archivos `.md` o en su memoria.

Frases que funcionan:
- *"Guardá en tu memoria que el proyecto de Prosegur usa un Supabase distinto."*
- *"Anotá en un archivo `.md` las decisiones importantes que vamos tomando."*
- *"Dejá un `DECISIONES.md` con lo que cambiamos hoy y por qué."*
- *"Antes de terminar, actualizá el `.md` de notas con lo nuevo."*

**Sugerencia de archivos para mantener:**
- `PLAN.md` → el plan actual de lo que estás construyendo.
- `DECISIONES.md` → decisiones importantes y el porqué (para no repetir discusiones).
- `PENDIENTES.md` → lo que falta hacer.

**Por qué:** cada vez que abrís una sesión nueva, el agente arranca "en blanco".
Si todo quedó escrito, retomás sin perder contexto.

---

## 6. Cosas técnicas importantes que tenés que saber

### El archivo `.env` (¡cuidado con esto!)
- Es donde viven las **claves secretas** (por ejemplo, la conexión a Supabase).
- En este proyecto se llama **`.env.local`** y está en la **raíz** de la carpeta.
- **NUNCA** se sube a GitHub. Si se sube, cualquiera podría ver tus claves.
- Hay un `.env.example` que es la **plantilla sin secretos** — ese sí se sube, sirve
  para saber qué claves hacen falta.

Frase útil: *"¿El `.env.local` está protegido y fuera de GitHub?"*

### El `.gitignore` (tu red de seguridad)
- Es un archivo que le dice a Git **qué NO subir** a GitHub.
- Acá ya están protegidos: `.env*` (secretos), `node_modules/`, `.next/`, `incoming/`.
- **Antes de subir algo, conviene chequear** que lo sensible esté en el `.gitignore`.

Frase útil: *"Confirmá que el `.gitignore` deja afuera los secretos y archivos pesados."*

### Ramas (branches) — no trabajar directo sobre la principal
- La rama principal suele ser `master` (o `main`). Es la versión "buena" y estable.
- **No trabajes directo ahí.** Creá una rama aparte para tus cambios.
- En este proyecto se usa una rama llamada **`develop`** para el trabajo del día a
  día. Recién cuando algo está probado y bien, pasa a `master`.

**Por qué:** si te equivocás en una rama aparte, `master` queda intacta. Es como
trabajar en una copia: probás tranquilo y, si funciona, lo integrás.

Frase útil: *"Hacé los cambios en la rama `develop`, no en `master`."*

---

## 7. GitHub: siempre por GitHub Desktop (no por terminal)

> Importante: para todo lo de GitHub usá **GitHub Desktop** (la app con interfaz),
> **no la terminal**. Es más visual y difícil de romper.

Flujo típico en GitHub Desktop:
1. **Current Branch** (arriba) → elegí o creá la rama **`develop`**.
   - Para crear: *Current Branch → New Branch → nombre `develop`*.
2. Hacé tus cambios con el agente (o a mano).
3. En GitHub Desktop vas a ver la lista de archivos cambiados a la izquierda.
   - Revisá que **no aparezca** ningún archivo de secretos (`.env.local`). Si aparece,
     **frená** y avisá — algo está mal en el `.gitignore`.
4. Abajo a la izquierda, escribí un **mensaje** corto de qué hiciste (ej: "Agrego
   formulario de Prosegur") y apretá **Commit to develop**.
5. Arriba, apretá **Push origin** para subirlo a GitHub (a la rama `develop`).

> Pedile al agente que **te diga qué cambió**, pero el commit y el push los hacés
> vos desde GitHub Desktop. Así tenés el control de qué se sube y a qué rama.

Frase útil para el agente:
- *"No toques GitHub por terminal. Yo subo los cambios desde GitHub Desktop."*

---

## Checklist rápido (para tener a mano)

- [ ] ¿Le pedí un **plan** antes de programar? ¿Quedó en un `.md`?
- [ ] ¿Le dije que **pregunte** si tiene dudas?
- [ ] ¿Pedí una **revisión de seguridad**?
- [ ] ¿**Probé** que funcione de verdad (`npm run dev` / `build`)?
- [ ] ¿Quedó **anotado** lo importante en memoria o en un `.md`?
- [ ] ¿Estoy en la rama **`develop`**, no en `master`?
- [ ] ¿El `.env.local` está **fuera** de GitHub (gracias al `.gitignore`)?
- [ ] ¿Subí los cambios desde **GitHub Desktop** (no por terminal)?

---

## Frases "todo en uno" para copiar y pegar

Para arrancar una tarea nueva:
> *"Antes de hacer nada: 1) hacé un plan y guardalo en un `.md`, 2) preguntame lo
> que no esté claro, 3) trabajá en la rama `develop`. No toques GitHub por terminal,
> eso lo hago yo desde GitHub Desktop."*

Para cerrar una tarea:
> *"Antes de terminar: probá que funcione, revisá si hay huecos de seguridad, y
> anotá en el `.md` de notas qué cambiamos y por qué."*
