# Guía para el Tester — Encuesta Mystery Shopper (Prosegur)

> **Para qué sirve este documento:** explicarte, en pocas líneas,
> **cómo tiene que funcionar** la encuesta, para que puedas testearla sin
> tener que adivinar nada. Si algo se comporta distinto a lo que dice acá, es un bug.

---

## 1. Qué es la encuesta (en 3 líneas)

Es la parte de una app web para hacer **"mystery shopper"** (cliente incógnito) a
empresas de alarmas. La **encuesta** es lo que completa la persona que hace el mystery
(el *postulante*), a través de un **link único**.

El testeo consiste en recorrer la encuesta y confirmar que funciona como se describe
abajo.

---

## 2. La encuesta del postulante (link público)

Es lo que ve la persona que realiza el mystery. Se entra por un **link con un token**
(ej. `.../encuesta/AbC123...`). **No pide usuario ni contraseña**: el link es la llave.

**Cómo tiene que funcionar:**

- Al abrir el link se ve la encuesta con una **barra de progreso** arriba y unos
  **puntitos** (uno por cada parte de la encuesta).
- Se responde **parte por parte**. No deja avanzar (`Siguiente`) hasta **completar
  todo lo obligatorio** del módulo actual; si falta algo, aparece un aviso.
- Hay **preguntas que aparecen o desaparecen** según respuestas anteriores (lógica
  condicional). Ejemplo: si en el screening elige "Presencial", más adelante se
  habilita el bloque de **evaluación presencial**; si elige "Prosegur", aparecen
  preguntas de servicios exclusivos de Prosegur.
- Algunas respuestas **descalifican** y cierran la encuesta con una pantalla de
  **agradecimiento** (ej.: elegir una región fuera de la cubierta). Es el
  comportamiento esperado, no un error.
- Se puede **cambiar el idioma** entre **Español y Portugués**; los textos deben
  traducirse.
- Al final de cada parte hay un módulo de **Evidencias** para **subir archivos**
  (audios, imágenes, videos, PDF, capturas). Es **opcional**: no bloquea el envío.
- Al terminar una parte, el botón dice **"Enviar a revisión"**. Al enviarla, esa
  parte queda **"en revisión"** y el postulante no la puede volver a tocar (salvo que
  se la reabra o se le pidan correcciones).
- El progreso se **guarda solo**: si cierra y vuelve a abrir el link, retoma donde
  estaba.

### Estados de cada parte (importante)

Cada parte de la encuesta pasa por estos estados. Se ven con el **color del puntito**
de arriba:

| Estado | Color | Qué significa |
|--------|-------|----------------|
| Pendiente | gris | Todavía no se envió a revisión |
| En revisión | amarillo | Enviada; falta que la revisen |
| Aprobada | verde | Fue aprobada; queda cerrada |
| Rechazada / con correcciones | rojo | Marcaron preguntas para corregir |

### Modo corrección (cuando piden cambios)

Si marcan preguntas para corregir, al volver a entrar al link el postulante ve:

- Las preguntas señaladas **resaltadas** y con una **nota** de qué corregir.
- Un navegador arriba tipo **"Corrección 1/3"** para ir de una corrección a la otra.
- Después de corregir, vuelve a **enviar a revisión**.

---

## 3. Cómo está armada la encuesta por dentro (las partes)

La encuesta se completa en **3 partes**. Esto ayuda a saber qué esperar en cada tramo:

| Parte | Nombre | Qué cubre |
|-------|--------|-----------|
| **Parte 1** | Contacto y evaluación comercial | Desde el *screening* (país, región, marca, categoría, canal) hasta la evaluación de la experiencia. Incluye contacto inicial, precio, visita, posicionamiento, detección de necesidades, presentación de la solución, negociación, competencia, cierre y (si aplica) evaluación presencial. Preguntas **hasta P55**. |
| **Parte 2** | Primer recontacto | Seguimiento posterior: si la empresa volvió a contactar, en cuánto tiempo, qué ofreció, nuevas promociones/precios. Preguntas **P56 a P63**. |
| **Parte 3** | Segundo recontacto | Igual que la Parte 2 pero para un **segundo** recontacto. Preguntas **P64 a P71**. |

> Cada parte termina con su módulo de **Evidencias** (opcional).

---

## 4. Escenarios de prueba recomendados (checklist)

Recorré estos casos y marcá si cada uno funciona como se describió arriba.

**Flujo completo (camino feliz)**
- [ ] Abrir el link y completar la **Parte 1** y enviarla a revisión.
- [ ] Confirmar que, una vez aprobada, la Parte 1 queda **aprobada** (verde) y no editable.
- [ ] Completar y enviar también **Parte 2** y **Parte 3**.

**Lógica condicional**
- [ ] Elegir **"Presencial"** en el screening y verificar que aparece el bloque de
      evaluación presencial.
- [ ] Elegir **"Prosegur"** como marca y verificar que aparecen sus preguntas exclusivas.
- [ ] Cambiar una respuesta y ver que las preguntas dependientes aparecen/desaparecen.

**Descalificación**
- [ ] Elegir una **región no cubierta** ("Otro") y verificar que la encuesta se
      **cierra con agradecimiento**.

**Validaciones**
- [ ] Intentar avanzar sin completar una pregunta **obligatoria** → debe **bloquear**.

**Evidencias**
- [ ] Subir un archivo en el módulo de evidencias y verificar que se ve/lista.
- [ ] Enviar una parte **sin** evidencias → debe **permitirlo** (es opcional).

**Ciclo de correcciones**
- [ ] Cuando una pregunta quede **marcada para corregir** con una nota, verificar que
      en el link aparece **resaltada con la nota** y el navegador "1/N".
- [ ] Corregir y **reenviar** a revisión.

**Idioma**
- [ ] Cambiar a **Portugués** y verificar que los textos se traducen.

**Persistencia**
- [ ] Cerrar el link a mitad de una parte y volver a abrirlo → debe **retomar** donde estaba.

---

## 5. Cómo reportar un problema

Cuando algo no funcione como dice esta guía, anotá:

1. **Dónde** pasó (qué pantalla de la encuesta).
2. **Qué hiciste** (pasos para reproducirlo).
3. **Qué esperabas** que pasara y **qué pasó** en realidad.
4. **Captura de pantalla** del error.
5. Idioma y, si aplica, país/marca elegidos (por la lógica condicional).

> Con eso alcanza para reproducir y arreglar el problema rápido. ¡Gracias!
