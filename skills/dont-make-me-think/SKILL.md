---
name: dont-make-me-think
description: Audita una pantalla o componente contra los principios de usabilidad de Steve Krug, localizando cada signo de pregunta que la interfaz le pone al usuario. Usar cuando se pide revisar la usabilidad de una pantalla, cuando un flujo confunde y no se sabe por qué, o antes de dar por cerrada una feature de UI.
metadata:
  fuente: "Steve Krug — Don't Make Me Think, Revisited (3ra ed.)"
  version: "1.0.0"
  argument-hint: <archivo, componente o ruta del dashboard>
---

# Don't Make Me Think — auditoría de carga cognitiva

Cada vez que el usuario se detiene a resolver algo que la pantalla debería haber respondido sola, la interfaz le puso un **signo de pregunta**. "¿Esto se puede clickear?" "¿Cómo se llamaba esto?" "¿Dónde estoy?" "¿Qué pasa si toco acá?" Cada uno consume atención que le hace falta para su tarea real, y se acumulan.

Esta auditoría hace una sola cosa: encontrar los signos de pregunta de un objetivo concreto y devolver el fix que los elimina. La accesibilidad técnica es de `accessibility-review`; el checklist de plataforma es de `web-design-guidelines`.

## Paso 1 — Fijar el objetivo y la tarea

Delimitá qué se audita (una page, un componente, un flujo de punta a punta) y escribí en una línea **a qué vino el usuario** a esa pantalla: "cargar una venta al fiado", "saber cuánto stock queda de una presentación".

Sin tarea no hay usabilidad. Un signo de pregunta cuenta solo si se interpone entre el usuario y esa tarea; lo demás es preferencia estética y no entra al reporte.

Criterio de avance: objetivo delimitado en archivos concretos y tarea escrita.

## Paso 2 — Ver la pantalla, no solo el código

Un `.vue` no muestra jerarquía visual, densidad ni qué queda sobre el pliegue. Si la app está corriendo, abrí la ruta y sacá un snapshot con la skill `playwright-cli` (las pages de `app/pages/dashboard/<recurso>/` mapean a `/dashboard/<recurso>`); mirá también el ancho móvil, que es donde el CRM se usa de verdad.

Si no se puede levantar, auditá el código y **declaralo como límite del reporte** en vez de inventar hallazgos visuales.

Criterio de avance: snapshot/screenshot obtenido, o límite declarado por escrito.

## Paso 3 — Los seis pases

Recorré los seis sobre cada texto visible y cada elemento interactivo del objetivo. Anotá candidatos sin filtrar todavía.

**1. Autoevidente (Ley 1).** El nombre de cada botón, label, título, columna y estado dice qué es o qué va a pasar, sin leer nada alrededor. Signos de pregunta típicos acá: verbos vacíos (*Procesar*, *Gestionar*, *Aceptar*), vocabulario del backend filtrado a la pantalla (*Item*, *Payload*, *Flag*, IDs crudos), nombres inventados para algo que ya tiene nombre en el negocio, iconos solos cuyo significado hay que adivinar.

**2. Clic sin ambigüedad (Ley 2).** Krug no cuenta clics: cuenta la duda por clic. Un flujo de cinco pasos obvios gana a uno de dos pasos donde hay que elegir a ciegas. Buscá opciones que se solapan, destinos que no se anticipan, elecciones forzadas sin default razonable, y confirmaciones que no explican qué se confirma.

**3. La mitad de las palabras, y otra vez la mitad (Ley 3).** Sacá el *happy talk* (texto de bienvenida que no informa) y las instrucciones que nadie lee. Un `description`/`hint` que repite el label es ruido; un párrafo de ayuda suele ser un campo mal nombrado.

**4. Billboard 101 — diseñar para escanear.** El usuario no lee: escanea, se conforma con la primera opción plausible y sigue. Verificá: una sola acción primaria por vista y visualmente dominante; lo relacionado agrupado y lo distinto separado; lo clickeable parece clickeable (y lo que no, no); ruido visual mínimo; texto en fragmentos escaneables. Las convenciones ya conocidas se respetan salvo que el reemplazo sea claramente mejor — y ante el conflicto, la claridad le gana a la consistencia.

**5. Estás aquí.** El título de la pantalla coincide con el link que se tocó para llegar, la sección activa está marcada en el sidebar y en la bottom nav, y desde cualquier punto se ve cómo volver. En modales y wizards: qué paso es, cuántos faltan, cómo se sale sin perder lo cargado.

**6. Reserva de buena voluntad.** Se drena ocultando lo que el usuario necesita (precio, stock, consecuencia), exigiendo un formato exacto sin decirlo, pidiendo datos que no hacen falta, y dejando errores sin salida. Se repone anticipando la pregunta y facilitando la recuperación. La lista completa está en [`referencia-krug.md`](referencia-krug.md), junto al trunk test, el capítulo de móvil y el de testing con usuarios — leelo cuando el objetivo sea la navegación, el dashboard de entrada, o cuando haya que justificar un hallazgo con la formulación original.

Criterio de avance: los seis pases recorridos sobre **cada** texto visible y **cada** elemento interactivo del objetivo, con la lista de candidatos escrita.

## Paso 4 — Depurar antes de reportar

El primer barrido de UI es casi todo ruido. Confirmá cada candidato uno por uno contra el archivo o el render, y descartá:

- lo que la implementación ya resuelve en otro lado (el label vive en `app/features/<f>/constants/*.constants.ts`, el estado activo lo pone el layout, el default lo aplica el store);
- lo que no toca la tarea del Paso 1;
- lo que es gusto personal y no una duda del usuario.

Un hallazgo sobrevive solo si podés nombrar **la pregunta exacta** que el usuario se hace y **dónde** se la hace.

Criterio de avance: cada candidato quedó confirmado o descartado; los descartados no aparecen en el reporte.

## Paso 5 — Reportar

Formato terso, una línea por hallazgo, ordenado por severidad:

```
archivo:línea  [SEVERIDAD]  la pregunta que se hace el usuario
                            → ley/heurística — fix concreto
```

- **ALTO** — bloquea o desvía la tarea; el usuario se equivoca o abandona.
- **MEDIO** — la completa, pero dudando o releyendo.
- **BAJO** — fricción menor, sin costo de tarea.

El fix es una instrucción aplicable, no un consejo: el texto exacto propuesto y el archivo donde va. En este CRM los textos de UI viven en las constantes de la feature, así que el fix de un nombre apunta ahí, no al `.vue`.

Cerrá con los límites: qué no se pudo verificar (render, datos reales, permisos de otro rol).

Criterio de cierre: cada hallazgo tiene archivo, severidad, pregunta del usuario y fix; y los límites están declarados.
