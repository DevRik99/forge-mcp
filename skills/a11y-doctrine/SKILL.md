---
name: a11y-doctrine
description: Referencia normativa completa de accesibilidad web (WCAG 2.2, ARIA, teclado, lectores de pantalla, contraste, área táctil). Incluye 22 reglas verificables con su cobertura por axe-core/eslint-plugin-vuejs-accessibility, checklist por criterio WCAG, 12 preguntas obligatorias de revisión, cifra de cobertura real de la automatización (57-80%, Deque) y comparativa honesta de herramientas. No cubre diseño visual general (ver ux-doctrine). Invocar antes de diseñar, implementar o revisar cualquier interfaz, formulario o componente interactivo.
---

# Accesibilidad Web (a11y) — Doctrina Normativa

Compilado a partir de WCAG 2.2 (W3C), WAI-ARIA (Using ARIA, ARIA APG), axe-core (Deque), eslint-plugin-vuejs-accessibility, MDN y WebAIM.

**Relación con `ux-doctrine`**: el diseño visual general (jerarquía, tipografía, color, espaciado, componentes, motion, mobile) vive en `ux-doctrine` como dominio propio. Este documento cubre exclusivamente lo **normativo**: qué exige WCAG, cómo se implementa correctamente con HTML/ARIA/teclado, y qué se puede verificar por código. Los puntos donde accesibilidad y diseño visual coinciden (contraste de color, tamaño de área táctil, `prefers-reduced-motion`) están **duplicados intencionalmente** en `ux-doctrine` — acá el criterio es "qué exige la norma y cómo se verifica", allá es "cómo se ve y se compone".

---

## 1. Marco normativo: WCAG 2.2

WCAG 2.2 es Recomendación W3C desde el 5 de octubre de 2023. Es retrocompatible: cumplir 2.2 implica cumplir 2.1 y 2.0. Elimina **4.1.1 Parsing** (ya no aplica: los navegadores/AT modernos no dependen de parseo directo de HTML por parte de la tecnología asistida).

### Los 4 principios POUR — qué significan operativamente

- **Perceivable (Perceptible)**: la información y los componentes de interfaz deben poder presentarse a los usuarios de forma que puedan percibirlos, sin importar el sentido (vista, oído, tacto). Operativamente: alternativas textuales, subtítulos, contraste, capacidad de redimensionar/reflow.
- **Operable (Operable)**: los componentes de interfaz y la navegación deben ser operables. Operativamente: todo funciona con teclado, hay tiempo suficiente, no hay contenido que provoque convulsiones, hay formas de orientarse (landmarks, títulos, foco visible).
- **Understandable (Comprensible)**: la información y el manejo de la interfaz deben ser comprensibles. Operativamente: texto legible y predecible, los componentes se comportan de forma consistente, se asiste en la corrección de errores.
- **Robust (Robusto)**: el contenido debe ser suficientemente robusto para ser interpretado de forma fiable por una amplia variedad de agentes de usuario, incluida la tecnología asistida. Operativamente: HTML válido, nombre/rol/valor expuestos correctamente vía accessibility tree.

### Niveles A / AA / AAA

- **A**: el mínimo. Sin él, algunos usuarios directamente no pueden usar el contenido.
- **AA**: el objetivo realista y el estándar legal de facto (ADA, EN 301 549, normas locales que citan WCAG AA). Es el nivel que se debería exigir por defecto en cualquier proyecto.
- **AAA**: el propio W3C aclara que **no se recomienda como requisito general para sitios completos** — algunos criterios AAA no pueden satisfacerse para todo tipo de contenido (ej. Reading Level 3.1.5 es inviable para contenido técnico). Vale la pena adoptar puntualmente:
  - **2.4.13 Focus Appearance** (indicador de foco robusto: 2px mínimo, contraste 3:1) — mejora tangible con costo bajo.
  - **2.5.5 Target Size Enhanced** (44×44px) para acciones primarias/críticas en móvil, aunque el mínimo legal sea 2.5.8 (24×24 AA).
  - **1.4.6 Contrast Enhanced** (7:1) para texto de lectura extensa si el diseño lo permite.
  - **3.3.5 Help** (ayuda contextual disponible) en formularios complejos.

### WCAG 2.2 — los 9 criterios nuevos respecto de 2.1

| Criterio | Nivel | Qué exige |
|---|---|---|
| 2.4.11 Focus Not Obscured (Minimum) | AA | El componente con foco de teclado no debe quedar **totalmente** oculto por contenido del autor (headers sticky, cookie banners, chat widgets) |
| 2.4.12 Focus Not Obscured (Enhanced) | AAA | Ninguna parte del componente con foco puede quedar oculta (más estricto que 2.4.11) |
| 2.4.13 Focus Appearance | AAA | Indicador de foco con área mínima equivalente a un borde de 2px CSS y contraste 3:1 contra los colores adyacentes |
| 2.5.7 Dragging Movements | AA | Toda función que se opera arrastrando (drag) debe tener una alternativa de un solo puntero (ej. botones ↑↓ además de drag-to-reorder) |
| 2.5.8 Target Size Minimum | AA | Objetivos táctiles/de puntero de al menos 24×24px CSS, con 5 excepciones (ver §Área táctil) |
| 3.2.6 Consistent Help | A | Mecanismos de ayuda (chat, contacto, FAQ) aparecen en el mismo orden relativo en todas las páginas donde existan |
| 3.3.7 Redundant Entry | A | No se debe pedir la misma información dos veces en el mismo proceso, salvo que sea esencial (ej. confirmar contraseña); debe autocompletarse o poder seleccionarse |
| 3.3.8 Accessible Authentication (Minimum) | AA | La autenticación no puede depender únicamente de una prueba cognitiva (recordar contraseña, resolver puzzle) sin alternativa — permite gestores de contraseñas, copiar/pegar, biometría |
| 3.3.9 Accessible Authentication (Enhanced) | AAA | Igual que 3.3.8 pero sin excepción para reconocimiento de objetos o contenido personal del usuario |

De estos 9, **6 son A o AA** (2.4.11, 2.5.7, 2.5.8, 3.2.6, 3.3.7, 3.3.8) — son los obligatorios para cualquier proyecto que apunte a AA. Los 3 restantes son AAA.

### Estado de APCA y WCAG 3.0 (verificado, no asumido — 2026-08-08)

- **WCAG 3.0** es actualmente **Working Draft**, sin fecha de Recomendación esperada antes de fines de esta década (2028-2030 según estimaciones de la industria, no del W3C mismo).
- **APCA (Advanced Perceptual Contrast Algorithm)** — contrario a la percepción común de que es "el sucesor confirmado" de la fórmula de contraste WCAG 2: el trabajo de contraste visual **fue removido del draft normativo de WCAG 3 en julio de 2023** para seguir evaluándose. El propio draft actual dice que el algoritmo de contraste de WCAG 3 está "yet to be determined". APCA sigue siendo exploratorio, no normativo.
- **Consecuencia práctica**: cualquier verificador de contraste debe seguir usando la fórmula WCAG 2 (luminancia relativa + ratio), no APCA. Adoptar APCA hoy sería adelantarse a una norma que no existe todavía.

---

## 2. Checklist accionable, agrupado por criterio WCAG

### Estructura y semántica
- Usar el elemento HTML nativo correcto antes que un `div`/`span` con rol ARIA (`<button>` no `<div onclick>`) — [W3C Using ARIA, regla 1]
- Un único `<h1>` por página/vista; jerarquía de encabezados sin saltos (`h2` no sigue directo a `h4`) — **1.3.1**
- Landmarks HTML5 (`<header>`, `<nav>`, `<main>`, `<footer>`) sin duplicar `<main>` ni `role="main"` más de una vez — **1.3.1, 2.4.1**
- Listas reales (`<ul>/<ol>` + `<li>`) para contenido que es una lista, no `<div>` con bullets CSS — **1.3.1**
- Tablas de datos con `<th scope="col|row">` y `<caption>` — **1.3.1**

### Teclado
- Toda acción disponible con mouse debe ejecutarse también con teclado — **2.1.1**
- Ningún componente atrapa el foco sin salida (modal sin `Escape`, sin foco que pueda volver a salir) — **2.1.2**
- Orden de tabulación sigue el orden visual/lógico, nunca `tabindex` positivo — **2.4.3**
- Foco visible en todo momento, con contraste mínimo 3:1 en el indicador — **2.4.7**
- El foco no debe quedar totalmente tapado por headers sticky, banners o widgets flotantes — **2.4.11**
- Al abrir un modal/drawer, el foco se mueve dentro de él; al cerrarlo, vuelve al elemento que lo abrió — patrón APG Dialog
- Al navegar entre rutas en una SPA, el foco se mueve explícitamente (al `h1` de la nueva vista o a un contenedor con `tabindex="-1"`) — defecto clásico invisible en SPAs, requerido en la práctica por 2.4.3 + 4.1.2 aunque no exista un criterio numerado exclusivo
- Proveer skip link al contenido principal — **2.4.1**

### ARIA
- Regla de oro: "no ARIA es mejor que ARIA mala" — usar solo cuando HTML nativo no alcanza
- No cambiar la semántica nativa de un elemento sin necesidad real (`<table role="log">` rompe la tabla) — [Using ARIA, regla 2]
- Todo control ARIA interactivo debe ser operable con teclado — [Using ARIA, regla 3]
- Nunca `role="presentation"` ni `aria-hidden="true"` sobre un elemento focusable — [Using ARIA, regla 4]
- Todo control interactivo necesita nombre accesible (`aria-label`, `aria-labelledby` o texto visible) — regla asociada por consenso de la industria (Deque, mtsknn), no está en el texto normativo de `using-aria` como quinta regla explícita
- Preferir `aria-labelledby` sobre `aria-label` cuando ya existe texto visible que puede referenciarse — MDN
- `aria-labelledby` tiene precedencia sobre `aria-label`, que a su vez tiene precedencia sobre el texto interno — MDN
- El nombre accesible debe **contener** el texto visible del control, no solo relacionarse con él — **2.5.3 Label in Name** (crítico para usuarios de control por voz, que dictan el texto que ven)
- `role="status"` (polite, no interrumpe) para mensajes informativos no urgentes; `role="alert"` (assertive, interrumpe) solo para mensajes urgentes y poco frecuentes — MDN
- El contenedor de un live region debe existir en el DOM **antes** de que cambie su contenido, para que el lector de pantalla lo esté observando

### Formularios
- Todo campo tiene `<label>` programáticamente asociado (`for`/`id`), no solo visualmente cercano — **1.3.1, 4.1.2**
- Mensajes de error asociados al campo vía `aria-describedby` — **3.3.1**
- `aria-invalid="true"` en campos con error tras el intento de envío — **4.1.2**
- Campos relacionados agrupados con `<fieldset>` + `<legend>` (ej. radios de un mismo grupo) — **1.3.1**
- Al fallar la validación, el foco se mueve al primer campo con error o a un resumen de errores enlazado a cada campo — **3.3.1, 3.3.3**
- `autocomplete` con valores estándar (`name`, `email`, `tel`, etc.) en campos que piden datos del usuario — **1.3.5**
- No pedir el mismo dato dos veces en un mismo flujo sin autocompletar o permitir copiarlo — **3.3.7**
- No depender de una prueba puramente cognitiva para autenticar (captcha visual sin alternativa, preguntas de memoria) — **3.3.8**

### Imágenes y media
- `alt` significativo en imágenes informativas; `alt=""` (vacío, no ausente) en decorativas — **1.1.1**
- Imágenes complejas (gráficos, diagramas) necesitan descripción larga además del `alt` corto — **1.1.1**
- SVG con rol semántico (`role="img"` + `aria-label`, o `<title>` interno) cuando transmite información — **1.1.1**
- Video pregrabado con subtítulos — **1.2.2**; audio-descripción cuando hay información visual relevante no narrada — **1.2.3**
- Nada de autoplay de audio >3 segundos sin control para pausar — **1.4.2**
- Animación disparada por interacción (hover, focus, scroll) debe poder desactivarse, salvo que sea esencial; respetar `prefers-reduced-motion` — **2.3.3 (AAA)**, complementa a **2.2.2 Pause/Stop/Hide** que cubre animación continua/autoplay

### Contraste, zoom y reflow
- Texto normal: contraste ≥ 4.5:1. Texto grande (≥18pt / ≥24px, o ≥14pt bold / ≥18.5px bold): ≥ 3:1 — **1.4.3**
- Componentes de interfaz (bordes de inputs, iconos funcionales, indicador de foco) y partes informativas de gráficos: ≥ 3:1 — **1.4.11**
- Sin excepción de contraste para: texto normal activo. Con excepción: logos, texto decorativo, componentes deshabilitados, texto dentro de una foto con mucho contenido visual — **1.4.3**
- Contenido usable con zoom 200% sin pérdida de función — **1.4.4**
- Contenido usable a un ancho equivalente de 320px CSS sin scroll horizontal (excepto tablas de datos, mapas, contenido que exige layout 2D) — **1.4.10**
- Respetar el espaciado de texto (`line-height`, letter/word-spacing) cuando el usuario lo sobreescribe con su propia hoja de estilos — **1.4.12**

### Área táctil
- Objetivos de puntero/táctiles de al menos 24×24px CSS (AA) — **2.5.8**. Excepciones: inline (dentro de una línea de texto), equivalente (existe otro control que hace lo mismo y sí cumple 24×24), controlado por el user agent, esencial (mapas, visualizaciones densas), o espaciado suficiente (círculo imaginario de 24px de diámetro sin intersección entre centros)
- Para controles primarios o de alto riesgo (eliminar, confirmar pago) conviene apuntar a 44×44px (AAA, **2.5.5**) aunque el mínimo legal sea 24×24
- Toda función que dependa de arrastrar (reordenar, sliders custom) necesita alternativa de un solo toque/clic — **2.5.7**

### Componentes complejos
- Antes de reimplementar un combobox, dialog, tabs, menu o tooltip a mano, usar los patrones del ARIA APG (w3.org/WAI/ARIA/apg/patterns/) como referencia de estructura, teclado y estados
- Preferir una librería headless accesible (Radix UI, Headless UI, Ark UI — Ark UI tiene adaptador Vue) sobre construir desde cero: la guía APG de un combobox por sí sola supera las 20 páginas de especificación de comportamiento e interacción; reimplementar a mano casi siempre deja huecos de teclado o de anuncio a lectores de pantalla

---

## 3. Preguntas obligatorias ante cualquier pantalla nueva

1. **¿Se puede completar la tarea completa sin mouse?** — Tab, Shift+Tab, Enter, Espacio, flechas donde el patrón ARIA lo pide (tabs, menús, radiogroups), Escape para cerrar overlays.
2. **¿El foco es visible en todo momento y nunca queda atrapado ni oculto?**
3. **¿Cada control interactivo tiene un nombre accesible que coincide con (o contiene) su texto visible?**
4. **¿Los mensajes de error/estado se anuncian a un lector de pantalla, y con la urgencia correcta (`status` vs `alert`)?**
5. **¿El contraste de texto, iconos funcionales y bordes de controles pasa 4.5:1 / 3:1 respectivamente, en todos los estados (default, hover, focus, disabled, error)?**
6. **¿La pantalla funciona a 320px de ancho (zoom 400%) sin scroll horizontal ni pérdida de función?**
7. **¿Todo objetivo táctil mide al menos 24×24px o cumple alguna de las 5 excepciones documentadas?**
8. **¿Al navegar (SPA) o al abrir/cerrar un overlay, el foco se mueve a un lugar predecible?**
9. **¿Los campos de formulario tienen label programático, y los errores están asociados con `aria-describedby`?**
10. **¿Si hay animación disparada por interacción, respeta `prefers-reduced-motion`?**
11. **¿El orden de lectura (DOM) coincide con el orden visual?** — un `order` de CSS Grid/Flexbox que reordena visualmente sin tocar el DOM rompe esto para lectores de pantalla y navegación por teclado.
12. **¿Se probó con al menos un lector de pantalla real (NVDA+Chrome o VoiceOver+Safari, las combinaciones más usadas)?** — ningún gate automático reemplaza esto.

---

## 4. Reglas verificables — 22 reglas

> Contrato de campos compartido con `ux-doctrine`, `qa-master` y `testing-guidelines` (namespace `a11y/*`). Campos por regla: `id`, `titulo`, `defecto`, `porque_importa`, `como_se_arregla`, `deteccion`, `tecnica`, `herramienta_existente`, `criterio_wcag`, `severidad`, `falsos_positivos`, `nivel`, `fuente`.

**Regla dura aplicada (no reimplementar lo que ya existe):** de las 22 reglas, **15 ya están implementadas** en axe-core o en eslint-plugin-vuejs-accessibility — el trabajo real es **habilitarlas y fijar sus umbrales**, no reimplementarlas. `herramienta_existente: ninguna` aparece solo en los 3 casos donde de verdad no hay herramienta que lo resuelva out-of-the-box (SPA focus management, orden de foco lógico, momento de live region), más 1 caso marcado explícitamente `no-automatizable`.

```json
[
  {
    "id": "a11y/imagen-sin-alt",
    "titulo": "Imagen sin texto alternativo",
    "defecto": "<img> o <input type=\"image\"> sin atributo alt",
    "porque_importa": "Quien usa lector de pantalla escucha solo el nombre de archivo o nada; no sabe qué muestra la imagen ni si es informativa o decorativa",
    "como_se_arregla": "Agregar alt descriptivo si la imagen es informativa, o alt=\"\" explícito si es decorativa",
    "deteccion": "codigo-fuente",
    "tecnica": "ESLint AST sobre template .vue",
    "herramienta_existente": "eslint-plugin-vuejs-accessibility (regla alt-text); axe-core (regla image-alt) como red de segunda capa sobre DOM renderizado",
    "criterio_wcag": "1.1.1 (A)",
    "severidad": "critico",
    "falsos_positivos": "bajo — la sola presencia/ausencia del atributo es binaria y objetiva",
    "nivel": "bloqueante",
    "fuente": "W3C WCAG 2.2 Understanding 1.1.1 — w3.org/WAI/WCAG22/Understanding/non-text-content.html"
  },
  {
    "id": "a11y/campo-sin-label",
    "titulo": "Campo de formulario sin label programático",
    "defecto": "Input/select/textarea sin <label for> asociado, ni aria-label, ni aria-labelledby",
    "porque_importa": "Quien usa lector de pantalla no sabe qué dato debe ingresar en el campo; el label visual sin asociación programática es invisible para AT",
    "como_se_arregla": "Asociar <label for=\"id\"> al id del control, o usar aria-labelledby si el texto visible vive en otro elemento",
    "deteccion": "codigo-fuente",
    "tecnica": "ESLint AST sobre template .vue",
    "herramienta_existente": "eslint-plugin-vuejs-accessibility (regla form-control-has-label); axe-core (regla label) sobre DOM renderizado",
    "criterio_wcag": "4.1.2 (A) / 1.3.1 (A)",
    "severidad": "critico",
    "falsos_positivos": "bajo",
    "nivel": "bloqueante",
    "fuente": "W3C WCAG 2.2 Understanding 4.1.2 — w3.org/WAI/WCAG22/Understanding/name-role-value.html"
  },
  {
    "id": "a11y/tabindex-positivo",
    "titulo": "tabindex con valor positivo",
    "defecto": "Atributo tabindex mayor a 0",
    "porque_importa": "Quien navega con teclado ve el orden de tabulación saltar de forma impredecible, rompiendo el flujo natural del documento",
    "como_se_arregla": "Usar tabindex=\"0\" (orden natural) o tabindex=\"-1\" (focusable solo por script); nunca un valor positivo",
    "deteccion": "codigo-fuente",
    "tecnica": "ESLint AST / regex sobre el atributo",
    "herramienta_existente": "eslint-plugin-vuejs-accessibility (regla tabindex-no-positive); axe-core (regla tabindex, best-practice)",
    "criterio_wcag": "2.4.3 (A)",
    "severidad": "alto",
    "falsos_positivos": "bajo",
    "nivel": "bloqueante",
    "fuente": "W3C WCAG 2.2 Understanding 2.4.3 — w3.org/WAI/WCAG22/Understanding/focus-order.html"
  },
  {
    "id": "a11y/aria-invalida",
    "titulo": "Atributo o rol ARIA inválido",
    "defecto": "aria-* que no existe en el spec, o role con valor que no es un rol ARIA válido/no-abstracto",
    "porque_importa": "El navegador ignora silenciosamente el atributo mal escrito; el usuario de AT pierde el estado o la semántica que el autor creía haber declarado",
    "como_se_arregla": "Corregir el nombre del atributo o el valor del rol contra el catálogo WAI-ARIA 1.2 vigente",
    "deteccion": "codigo-fuente",
    "tecnica": "ESLint AST contra el catálogo ARIA 1.2",
    "herramienta_existente": "eslint-plugin-vuejs-accessibility (reglas aria-props, aria-role); axe-core (reglas aria-valid-attr, aria-valid-attr-value, aria-roles, aria-allowed-attr)",
    "criterio_wcag": "4.1.2 (A)",
    "severidad": "alto",
    "falsos_positivos": "bajo",
    "nivel": "bloqueante",
    "fuente": "axe-core rule-descriptions.md — github.com/dequelabs/axe-core"
  },
  {
    "id": "a11y/rol-redundante",
    "titulo": "Rol ARIA redundante con la semántica nativa",
    "defecto": "role que ya es el rol implícito del elemento, ej. <button role=\"button\">",
    "porque_importa": "No rompe nada por sí solo, pero es ruido que puede quedar desactualizado si el elemento cambia y el rol explícito no se actualiza junto",
    "como_se_arregla": "Quitar el role explícito cuando coincide con el implícito del elemento nativo",
    "deteccion": "codigo-fuente",
    "tecnica": "ESLint AST",
    "herramienta_existente": "eslint-plugin-vuejs-accessibility (regla no-redundant-roles)",
    "criterio_wcag": "best-practice",
    "severidad": "bajo",
    "falsos_positivos": "bajo",
    "nivel": "reporte",
    "fuente": "eslint-plugin-vuejs-accessibility — vue-a11y.github.io/eslint-plugin-vuejs-accessibility"
  },
  {
    "id": "a11y/click-sin-teclado",
    "titulo": "Elemento clickeable sin soporte de teclado equivalente",
    "defecto": "Manejador de click (@click) en un elemento no interactivo nativamente, sin manejador de teclado ni tabindex/rol que lo haga focusable",
    "porque_importa": "Quien navega con teclado no puede alcanzar ni activar el control: el div nunca recibe foco y Enter/Espacio no hacen nada",
    "como_se_arregla": "Usar <button> nativo, o si debe ser un div, agregar tabindex=\"0\", rol apropiado y manejador de @keydown para Enter/Espacio",
    "deteccion": "codigo-fuente",
    "tecnica": "ESLint AST",
    "herramienta_existente": "eslint-plugin-vuejs-accessibility (reglas click-events-have-key-events, interactive-supports-focus, no-static-element-interactions)",
    "criterio_wcag": "2.1.1 (A)",
    "severidad": "critico",
    "falsos_positivos": "medio — el elemento puede ya ser interactivo por otra vía que el linter no reconoce (ej. un componente hijo que internamente ya maneja teclado)",
    "nivel": "bloqueante",
    "fuente": "W3C WCAG 2.2 Understanding 2.1.1 — w3.org/WAI/WCAG22/Understanding/keyboard.html"
  },
  {
    "id": "a11y/autofocus-presente",
    "titulo": "Uso de autofocus",
    "defecto": "Atributo autofocus en un input o elemento focusable",
    "porque_importa": "Mueve el foco sin que el usuario lo pida, desorientando a quien navega con teclado o lector de pantalla al perder su posición en la página",
    "como_se_arregla": "Quitar autofocus salvo en un diálogo modal recién abierto donde mover el foco ahí es la expectativa correcta",
    "deteccion": "codigo-fuente",
    "tecnica": "ESLint AST",
    "herramienta_existente": "eslint-plugin-vuejs-accessibility (regla no-autofocus, no recomendada por defecto)",
    "criterio_wcag": "best-practice (relacionado a 3.2.1 On Focus)",
    "severidad": "medio",
    "falsos_positivos": "medio — legítimo en diálogos/modales que deben recibir foco al abrir; el linter no distingue el contexto",
    "nivel": "reporte",
    "fuente": "eslint-plugin-vuejs-accessibility — vue-a11y.github.io/eslint-plugin-vuejs-accessibility"
  },
  {
    "id": "a11y/iframe-sin-titulo",
    "titulo": "iframe sin título",
    "defecto": "<iframe> sin atributo title",
    "porque_importa": "Quien usa lector de pantalla no puede identificar el propósito del iframe antes de entrar en él",
    "como_se_arregla": "Agregar title descriptivo del contenido embebido",
    "deteccion": "codigo-fuente",
    "tecnica": "ESLint AST",
    "herramienta_existente": "eslint-plugin-vuejs-accessibility (regla iframe-has-title); axe-core (reglas frame-title, frame-title-unique)",
    "criterio_wcag": "4.1.2 (A)",
    "severidad": "medio",
    "falsos_positivos": "bajo",
    "nivel": "bloqueante",
    "fuente": "axe-core rule-descriptions.md — github.com/dequelabs/axe-core"
  },
  {
    "id": "a11y/media-sin-subtitulos",
    "titulo": "Video sin pista de subtítulos",
    "defecto": "<video> sin <track kind=\"captions\">",
    "porque_importa": "Usuarios sordos o hipoacúsicos no acceden al contenido hablado del video",
    "como_se_arregla": "Agregar pista de subtítulos sincronizada",
    "deteccion": "codigo-fuente",
    "tecnica": "ESLint AST",
    "herramienta_existente": "eslint-plugin-vuejs-accessibility (regla media-has-caption); axe-core (regla video-caption)",
    "criterio_wcag": "1.2.2 (A)",
    "severidad": "alto",
    "falsos_positivos": "bajo",
    "nivel": "bloqueante",
    "fuente": "axe-core rule-descriptions.md — github.com/dequelabs/axe-core"
  },
  {
    "id": "a11y/autocomplete-invalido",
    "titulo": "Valor de autocomplete fuera del vocabulario HTML",
    "defecto": "Atributo autocomplete con un valor que no pertenece al spec (ej. typo o valor inventado)",
    "porque_importa": "El navegador no puede autocompletar el campo ni exponer su propósito a tecnología asistida; usuarios con discapacidad cognitiva pierden el autocompletado que reduce carga de memoria",
    "como_se_arregla": "Usar un valor del vocabulario estándar (name, email, tel, street-address, etc.)",
    "deteccion": "codigo-fuente",
    "tecnica": "Regex/AST sobre el valor del atributo contra la lista fija del spec HTML",
    "herramienta_existente": "axe-core (regla autocomplete-valid)",
    "criterio_wcag": "1.3.5 (AA)",
    "severidad": "medio",
    "falsos_positivos": "bajo",
    "nivel": "bloqueante",
    "fuente": "W3C WCAG 2.2 Understanding 1.3.5 — w3.org/WAI/WCAG22/Understanding/identify-input-purpose.html"
  },
  {
    "id": "a11y/contraste-insuficiente",
    "titulo": "Contraste de color insuficiente",
    "defecto": "Ratio de contraste entre texto/fondo o entre componente-UI/fondo por debajo del mínimo exigido",
    "porque_importa": "Usuarios con baja visión o daltonismo no distinguen el texto o el control del fondo; a mayor edad de la población de usuarios, mayor incidencia",
    "como_se_arregla": "Ajustar el color de texto o fondo hasta alcanzar 4.5:1 (texto normal) / 3:1 (texto grande, componentes UI, gráficos informativos)",
    "deteccion": "ambos",
    "tecnica": "Sobre tokens de diseño estáticos: script que calcula luminancia relativa (fórmula WCAG 2, NO APCA) contra el par definido. Sobre DOM renderizado: axe-core lee el color final ya compuesto por el navegador (necesario si hay theming dinámico, dark mode, opacidad heredada, gradientes)",
    "herramienta_existente": "axe-core (reglas color-contrast wcag2aa, non-text-contrast vía color-contrast también cubre 1.4.11 parcialmente, color-contrast-enhanced para AAA)",
    "criterio_wcag": "1.4.3 (AA) / 1.4.11 (AA)",
    "severidad": "critico",
    "falsos_positivos": "bajo — axe-core es conservador: si no puede determinar el color final con certeza, no reporta en vez de adivinar",
    "nivel": "bloqueante",
    "fuente": "W3C WCAG 2.2 Understanding 1.4.3 y 1.4.11 — w3.org/WAI/WCAG22/Understanding/contrast-minimum.html"
  },
  {
    "id": "a11y/objetivo-tactil-pequeno",
    "titulo": "Objetivo táctil por debajo del tamaño mínimo",
    "defecto": "Área clickeable/táctil renderizada menor a 24×24px CSS, sin cumplir ninguna de las 5 excepciones (inline, equivalente, user-agent, esencial, espaciado suficiente)",
    "porque_importa": "Usuarios con temblor, baja precisión motora, o simplemente en móvil con el dedo, fallan el toque y activan el control vecino o ninguno",
    "como_se_arregla": "Aumentar el padding/hit-area hasta 24×24px, o separar objetivos vecinos con un círculo imaginario de 24px de diámetro sin intersección",
    "deteccion": "dom-renderizado",
    "tecnica": "Playwright/axe-core leyendo getBoundingClientRect() en el viewport real objetivo — el CSS fuente no siempre coincide con el tamaño final (padding, line-height, contenido dinámico)",
    "herramienta_existente": "axe-core (regla target-size, tag wcag22aa)",
    "criterio_wcag": "2.5.8 (AA)",
    "severidad": "alto",
    "falsos_positivos": "medio — layouts flex/grid con tamaño variable según viewport pueden dar falsos positivos si se testea en un solo breakpoint",
    "nivel": "bloqueante",
    "fuente": "W3C WCAG 2.2 Understanding 2.5.8 — w3.org/WAI/WCAG22/Understanding/target-size-minimum.html"
  },
  {
    "id": "a11y/landmark-duplicado",
    "titulo": "Landmark de página duplicado o ausente",
    "defecto": "Más de un <main>/role=\"main\" en la página, o contenido sin ningún landmark contenedor",
    "porque_importa": "Quien navega saltando entre landmarks con el lector de pantalla no puede identificar cuál es el contenido principal, o se pierde contenido que no está en ningún landmark",
    "como_se_arregla": "Un único <main> por vista; envolver todo contenido en header/nav/main/footer/aside según corresponda",
    "deteccion": "dom-renderizado",
    "tecnica": "axe-core sobre el DOM ensamblado — la duplicación suele originarse en composición de componentes (dos componentes que cada uno declara su propio main), invisible leyendo cada archivo por separado",
    "herramienta_existente": "axe-core (reglas landmark-one-main, landmark-no-duplicate-main, landmark-unique, region — todas best-practice)",
    "criterio_wcag": "1.3.1 (A) / best-practice",
    "severidad": "medio",
    "falsos_positivos": "bajo",
    "nivel": "reporte",
    "fuente": "axe-core rule-descriptions.md — github.com/dequelabs/axe-core"
  },
  {
    "id": "a11y/heading-jerarquia-salteada",
    "titulo": "Salto de nivel en la jerarquía de encabezados",
    "defecto": "Un h{N} seguido de h{N+2} o mayor, sin nivel intermedio (ej. h2 directo a h4)",
    "porque_importa": "Quien navega por encabezados con lector de pantalla usa la jerarquía como mapa de la página; un salto rompe la relación de contención esperada entre secciones",
    "como_se_arregla": "Usar niveles consecutivos según la profundidad real de la sección, no elegir el nivel por el tamaño visual deseado",
    "deteccion": "ambos",
    "tecnica": "En código fuente: ESLint AST detecta headings vacíos y da una señal parcial. La jerarquía REAL solo se conoce en el DOM ensamblado, porque el nivel que usa un componente hijo depende del contexto de montaje — imposible de saber leyendo el componente aislado",
    "herramienta_existente": "eslint-plugin-vuejs-accessibility (regla heading-has-content, solo detecta vacíos); axe-core (regla heading-order, best-practice) para la jerarquía real",
    "criterio_wcag": "1.3.1 (A) / 2.4.6 (AA) / best-practice",
    "severidad": "medio",
    "falsos_positivos": "medio — algunos diseños usan un h1 visualmente distinto del semántico a propósito; raro pero existe",
    "nivel": "reporte",
    "fuente": "axe-core rule-descriptions.md — github.com/dequelabs/axe-core"
  },
  {
    "id": "a11y/foco-orden-ilogico",
    "titulo": "Orden de tabulación no coincide con el orden visual",
    "defecto": "Al presionar Tab repetidamente, el foco salta a posiciones visuales no correlativas (afectado por tabindex, order de CSS Grid/Flexbox, teleports de Vue)",
    "porque_importa": "Quien navega con teclado pierde la orientación: el foco aparece en un lugar de la pantalla distinto al que la secuencia de Tab hacía esperar",
    "como_se_arregla": "Alinear el orden del DOM con el orden visual, o evitar el uso de order de CSS que reordena visualmente sin tocar el DOM",
    "deteccion": "dom-renderizado",
    "tecnica": "Playwright: simular Tab repetido, comparar document.activeElement contra getBoundingClientRect() en cada paso",
    "herramienta_existente": "ninguna — axe-core no evalúa secuencias de interacción; existe la regla experimental focus-order-semantics pero solo valida que el rol del elemento con foco sea apropiado, no el orden en sí",
    "criterio_wcag": "2.4.3 (A)",
    "severidad": "alto",
    "falsos_positivos": "alto — \"orden lógico\" es subjetivo en layouts complejos (dashboards multi-columna); el gate automático solo puede detectar inversiones groseras, el resto exige criterio humano",
    "nivel": "reporte",
    "fuente": "W3C WCAG 2.2 Understanding 2.4.3 — w3.org/WAI/WCAG22/Understanding/focus-order.html"
  },
  {
    "id": "a11y/foco-no-visible",
    "titulo": "Indicador de foco ausente o imperceptible",
    "defecto": "Al recibir foco por teclado, el elemento no muestra ningún cambio visual perceptible (outline removido sin reemplazo)",
    "porque_importa": "Quien navega con teclado no sabe en qué elemento está parado; no puede orientarse ni confirmar que su Tab tuvo efecto",
    "como_se_arregla": "Nunca outline: none sin un reemplazo visible (box-shadow, cambio de fondo, borde) con contraste ≥3:1 contra el fondo",
    "deteccion": "dom-renderizado",
    "tecnica": "Playwright: forzar foco por teclado, comparar estilos computados/screenshot antes y después — debe detectar CUALQUIER cambio visual perceptible, no solo la propiedad outline",
    "herramienta_existente": "ninguna — axe-core no puede evaluar percepción visual del estado :focus de forma confiable a través de renders dinámicos",
    "criterio_wcag": "2.4.7 (AA)",
    "severidad": "critico",
    "falsos_positivos": "medio — algunos diseños usan box-shadow o cambio de fondo en vez de outline; el detector debe reconocer ambos caminos válidos, no exigir una implementación única",
    "nivel": "bloqueante",
    "fuente": "W3C WCAG 2.2 Understanding 2.4.7 — w3.org/WAI/WCAG22/Understanding/focus-visible.html"
  },
  {
    "id": "a11y/foco-obscurecido",
    "titulo": "Elemento con foco tapado por contenido superpuesto",
    "defecto": "El elemento que recibe foco de teclado queda total o parcialmente oculto detrás de un header sticky, banner de cookies o widget flotante",
    "porque_importa": "Quien usa lector de pantalla con magnificación, o simplemente sigue el foco visualmente, no ve el elemento activo aunque el foco técnicamente esté ahí",
    "como_se_arregla": "Agregar scroll-margin-top (u offset equivalente) para que el elemento enfocado quede visible por debajo de elementos fixed/sticky",
    "deteccion": "dom-renderizado",
    "tecnica": "Playwright: enfocar el elemento, comparar su getBoundingClientRect() contra los elementos position:fixed/sticky con z-index mayor que lo superponen",
    "herramienta_existente": "ninguna — es un criterio nuevo de WCAG 2.2 (oct. 2023), axe-core todavía no tiene una regla estable publicada para esto al momento de esta investigación",
    "criterio_wcag": "2.4.11 (AA)",
    "severidad": "alto",
    "falsos_positivos": "medio — depende de detectar correctamente qué elementos superpuestos son \"contenido del autor\" vs UI del navegador",
    "nivel": "reporte",
    "fuente": "W3C — What's New in WCAG 2.2 — w3.org/WAI/standards-guidelines/wcag/new-in-22/"
  },
  {
    "id": "a11y/reflow-320px",
    "titulo": "Scroll horizontal a 320px de ancho",
    "defecto": "El contenido requiere scroll en dos dimensiones a un viewport equivalente de 320 CSS px (desktop 1280px + zoom 400%)",
    "porque_importa": "Usuarios con baja visión que usan zoom alto deben desplazarse horizontal Y verticalmente para leer, perdiendo contexto constantemente",
    "como_se_arregla": "Layout responsive que reflowea a una columna en ese ancho; excepción legítima para tablas de datos y mapas donde el layout 2D es esencial",
    "deteccion": "dom-renderizado",
    "tecnica": "Playwright: resize_page(320, alto) + verificar scrollWidth > clientWidth en document.body",
    "herramienta_existente": "ninguna regla de axe-core cubre esto directamente (axe no simula resize); Lighthouse tiene una auditoría relacionada de viewport pero no equivalente exacta",
    "criterio_wcag": "1.4.10 (AA)",
    "severidad": "alto",
    "falsos_positivos": "bajo — la presencia de scroll horizontal es objetivamente medible",
    "nivel": "bloqueante",
    "fuente": "W3C WCAG 2.2 Understanding 1.4.10 — w3.org/WAI/WCAG22/Understanding/reflow.html"
  },
  {
    "id": "a11y/interactivo-anidado",
    "titulo": "Control interactivo anidado dentro de otro control interactivo",
    "defecto": "Ej. un <button> dentro de un <a>, o un rol interactivo ARIA dentro de otro",
    "porque_importa": "Los lectores de pantalla no pueden operar el control interno de forma confiable; el árbol de accesibilidad no soporta anidación de interactivos",
    "como_se_arregla": "Reestructurar para que los controles interactivos sean hermanos, no ancestro-descendiente",
    "deteccion": "dom-renderizado",
    "tecnica": "axe-core sobre DOM ensamblado — la anidación puede originarse en composición de componentes, invisible en el código fuente de cada componente por separado",
    "herramienta_existente": "axe-core (regla nested-interactive)",
    "criterio_wcag": "4.1.2 (A)",
    "severidad": "alto",
    "falsos_positivos": "bajo",
    "nivel": "bloqueante",
    "fuente": "axe-core rule-descriptions.md — github.com/dequelabs/axe-core"
  },
  {
    "id": "a11y/live-region-momento-incorrecto",
    "titulo": "Live region no anuncia en el momento correcto",
    "defecto": "El contenido de un aria-live/role=status/role=alert cambia en el mismo render inicial (antes de que el lector de pantalla esté \"observando\" el nodo), o el anuncio llega demasiado tarde/interrumpe algo más importante",
    "porque_importa": "Un mensaje de error o confirmación que no se anuncia a tiempo deja al usuario de lector de pantalla sin saber si su acción tuvo efecto",
    "como_se_arregla": "Montar el contenedor live vacío primero, y recién después escribir el contenido dinámico en una actualización posterior del DOM",
    "deteccion": "no-automatizable",
    "tecnica": "Se puede confirmar técnicamente que el nodo cambia después del montaje inicial (Playwright + snapshot del árbol de accesibilidad antes/después), pero si el momento es el CORRECTO desde la experiencia del usuario es un juicio, no una regla binaria",
    "herramienta_existente": "ninguna",
    "criterio_wcag": "4.1.3 (AA)",
    "severidad": "medio",
    "falsos_positivos": "alto — por eso se marca no-automatizable; cualquier heurística de timing genera más ruido que señal",
    "nivel": "reporte",
    "fuente": "Deque — recomendación de precisión sobre cobertura, deque.com/blog (ver §6)"
  },
  {
    "id": "a11y/spa-foco-no-gestionado",
    "titulo": "Navegación SPA sin gestión de foco",
    "defecto": "Al cambiar de ruta en una SPA, el foco permanece en el elemento que disparó la navegación (o se pierde) en vez de moverse a la nueva vista",
    "porque_importa": "Quien usa lector de pantalla no recibe ninguna señal de que la página cambió; sigue posicionado en un control que ya no tiene sentido en el nuevo contexto",
    "como_se_arregla": "Al montar la nueva vista, mover el foco explícitamente al h1 de la vista o a un contenedor con tabindex=\"-1\"",
    "deteccion": "dom-renderizado",
    "tecnica": "Playwright: navegar programáticamente, verificar document.activeElement tras la transición de ruta",
    "herramienta_existente": "ninguna — es un defecto de arquitectura de la SPA, no una propiedad estática del DOM que axe-core pueda evaluar en un snapshot",
    "criterio_wcag": "2.4.3 (A) — aplicación práctica, sin criterio numerado exclusivo para SPA",
    "severidad": "alto",
    "falsos_positivos": "bajo — la posición del foco tras la navegación es objetivamente verificable",
    "nivel": "reporte",
    "fuente": "Adrian Roselli / Scott O'Hara — práctica de la comunidad de accesibilidad, sin criterio WCAG dedicado"
  },
  {
    "id": "a11y/nombre-no-contiene-texto-visible",
    "titulo": "Nombre accesible no contiene el texto visible del control",
    "defecto": "El aria-label o aria-labelledby de un control no incluye el texto que se ve en pantalla (ej. botón que dice \"Enviar\" pero aria-label=\"Confirmar formulario\")",
    "porque_importa": "Usuarios de control por voz dictan el texto que VEN para activar el control; si el nombre accesible no lo contiene, el comando de voz falla",
    "como_se_arregla": "El nombre accesible debe contener, como mínimo, el texto visible exacto o una versión que lo incluya como substring",
    "deteccion": "dom-renderizado",
    "tecnica": "axe-core calcula el nombre accesible final (que depende de labelledby/label/texto interno ya resueltos) y lo compara contra el texto visible renderizado",
    "herramienta_existente": "axe-core (regla experimental label-content-name-mismatch, tag wcag21a)",
    "criterio_wcag": "2.5.3 (A)",
    "severidad": "medio",
    "falsos_positivos": "medio — regla marcada experimental por el propio axe-core, no graduada a estable todavía",
    "nivel": "reporte",
    "fuente": "axe-core rule-descriptions.md — github.com/dequelabs/axe-core"
  }
]
```

### Resumen de cobertura por herramienta

| Herramienta | Reglas de este catálogo que ya cubre |
|---|---|
| `axe-core` | `imagen-sin-alt`, `campo-sin-label`, `tabindex-positivo`, `aria-invalida`, `iframe-sin-titulo`, `media-sin-subtitulos`, `autocomplete-invalido`, `contraste-insuficiente`, `objetivo-tactil-pequeno`, `landmark-duplicado`, `heading-jerarquia-salteada`, `interactivo-anidado`, `nombre-no-contiene-texto-visible` |
| `eslint-plugin-vuejs-accessibility` | `imagen-sin-alt`, `campo-sin-label`, `tabindex-positivo`, `aria-invalida`, `rol-redundante`, `click-sin-teclado`, `autofocus-presente`, `iframe-sin-titulo`, `media-sin-subtitulos`, `heading-jerarquia-salteada` (parcial, solo vacíos) |
| Sin herramienta (implementar con Playwright) | `foco-orden-ilogico`, `foco-no-visible`, `foco-obscurecido`, `reflow-320px`, `spa-foco-no-gestionado` |
| Marcada `no-automatizable` | `live-region-momento-incorrecto` |

---

## 5. Lo que NO se puede automatizar

**Cifra citada**: la automatización de Deque (axe-core solo) identifica **57.38%** de los problemas de accesibilidad reales encontrados en auditorías; combinada con Intelligent Guided Testing (flujo semi-automatizado con intervención humana dirigida) sube a **80.39%**. Fuente: [Deque — Automated Testing Study Identifies 57 Percent of Digital Accessibility Issues](https://www.deque.com/blog/automated-testing-study-identifies-57-percent-of-digital-accessibility-issues/), basado en el análisis de más de 13.000 páginas/estados de página y casi 300.000 issues.

Esto significa que **más del 40% de los problemas reales requieren revisión humana**, incluso con el motor de reglas más agresivo del mercado en no reportar falsos positivos.

Deque documenta explícitamente esta distinción entre automatizable y no automatizable, y recomienda **precisión sobre cobertura**: es preferible un set de reglas que no genera ruido a uno que marca más casos pero con falsos positivos, porque el ruido es lo que hace que los equipos apaguen el gate entero.

### Ejemplos concretos de lo NO automatizable, y por qué

- **Si el `alt` describe la imagen correctamente**: un script puede confirmar que el atributo existe y no está vacío; no puede saber si "imagen1.jpg" o "foto de personas" es una descripción útil versus el contenido real de la imagen. Requiere revisión humana o, como mucho, un LLM con la imagen (no un linter).
- **Si el orden de foco es lógico**: un script puede detectar inversiones groseras contra el orden visual (`a11y/foco-orden-ilogico`), pero "lógico" en un layout con múltiples columnas o un dashboard es una decisión de diseño, no una propiedad computable.
- **Si el mensaje de error es comprensible**: un script confirma que existe y está asociado (`aria-describedby`); no puede juzgar si "Error de validación" es más o menos útil que "El email debe tener el formato nombre@dominio.com".
- **Si un live region anuncia en el momento correcto**: técnicamente se puede confirmar que el nodo cambia, pero si el anuncio es oportuno (ni demasiado tarde ni interrumpe algo más importante) es un juicio de experiencia, no una regla binaria.
- **Si el nombre accesible describe la función real del control** (más allá de que exista): un botón con `aria-label="Enviar"` pasa el gate técnico aunque en ese contexto la acción real sea "Cancelar".
- **Contenido en lenguaje simple / nivel de lectura**: WCAG 3.1.5 (AAA) es explícitamente no automatizable a nivel de "es comprensible" — como mucho hay heurísticas de longitud de oración, no de comprensión real.
- **Si un componente ARIA-custom realmente se comporta como el patrón APG que dice implementar** (ej. un combobox que declara `role="combobox"` pero no soporta las flechas): axe-core valida estructura y atributos válidos, no el comportamiento dinámico completo — eso exige testeo con teclado real o con lector de pantalla real.

**Consecuencia para el diseño de gates**: el comando de verificación automatizado cubre bien la "forma" (¿existe el atributo, el ratio es numérico, la estructura es válida?) y **no reemplaza** una pasada con teclado + un lector de pantalla real antes de dar por cerrada una pantalla nueva (ver §3, pregunta 12).

---

## 6. Herramientas — comparativa honesta

| Herramienta | Qué detecta de verdad | Qué NO detecta | Notas |
|---|---|---|---|
| **axe-core** | Reglas estructurales/DOM: ARIA inválida, contraste computado, landmarks, nombres accesibles ausentes, atributos requeridos faltantes. ~90 reglas activas (v4.9), categorizadas `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`, `best-practice`, `wcag2aaa`, `experimental`, `deprecated` | Comportamiento dinámico de teclado, calidad semántica del texto (alt/labels/mensajes), momento de anuncio de live regions, orden de foco "lógico" | Motor usado por Lighthouse, `@axe-core/playwright`, y la mayoría de extensiones de navegador. Prioriza no reportar falsos positivos por sobre cobertura máxima. |
| **@axe-core/playwright** | Igual que axe-core, pero integrado a un test E2E real: corre sobre el DOM ya renderizado tras interacciones (abrir modal, enviar formulario) | Igual limitación que axe-core; el valor agregado es que puede testear estados post-interacción, no solo el estado inicial de carga | Es el puente correcto entre axe-core y un flujo de CI con Playwright. |
| **eslint-plugin-vuejs-accessibility** | Errores estáticos en templates `.vue` antes de renderizar: `alt` ausente, labels sin asociar, `tabindex` positivo, roles ARIA inválidos, clicks sin soporte de teclado. 23 reglas confirmadas en el código fuente (21 recomendadas por defecto) | Todo lo que depende del DOM ensamblado en runtime (contraste real, landmarks duplicados por composición de componentes, jerarquía de heading final) | Es el único de esta lista específico para Vue/Nuxt; corre en cada commit sin overhead de navegador. |
| **eslint-plugin-jsx-a11y** | Equivalente de lo anterior para JSX/React: `alt-text`, `label-has-associated-control`, `click-events-have-key-events`, `autocomplete-valid`, etc. | Misma limitación de runtime que el plugin de Vue | Verificar versión con `npm view` antes de adoptar; el peer de ESLint debe coincidir con el del proyecto. |
| **pa11y** | Envoltorio de HTML_CodeSniffer o axe-core sobre una URL real (headless Chrome), pensado para correr en CI contra una lista de URLs | Mismas limitaciones que el motor subyacente que use (axe o HTML_CS) | Útil para barrer muchas páginas de una vez en un pipeline, menos preciso para testear estados interactivos específicos. |
| **Lighthouse (a11y audit)** | Subconjunto de reglas de axe-core, enfocado en un puntaje agregado (0-100) | El puntaje puede ser alto y la app seguir siendo inusable con teclado o lector de pantalla — el puntaje mide cobertura de reglas automatizables, no experiencia real | No usar el puntaje de Lighthouse como criterio único de "accesible"; es un piso, no un techo. |

---

## 7. Contraste, área táctil y motion — criterio normativo

> Estos tres puntos están **duplicados intencionalmente** en `ux-doctrine` (§4.2/§4.4, §6.3/§11.1, §7.3) porque también son decisiones de diseño visual. Acá se documenta el criterio normativo completo.

### Contraste (WCAG 1.4.3 / 1.4.11)

| Criterio | Nivel AA | Nivel AAA |
|----------|----------|-----------|
| Texto normal (<18px regular, <14px bold) | 4.5:1 | 7:1 |
| Texto grande (≥18px regular, ≥14px bold) | 3:1 | 4.5:1 |
| Componentes UI (bordes, iconos funcionales) | 3:1 | — |
| Elementos gráficos informativos | 3:1 | — |

El color **nunca** es el único indicador de estado — 8% de los hombres son daltónicos y no distinguen rojo de verde; siempre acompañar con icono y/o texto.

### Área táctil (WCAG 2.5.8 / 2.5.5)

Contradicción documentada entre estándares — no se promedia, se aplica el estándar de la plataforma:

| Estándar | Valor | Contexto |
|---|---|---|
| Apple HIG | 44×44 **puntos** | iOS nativo |
| Material Design 3 | 48×48 **dp**, 8dp de espaciado mínimo entre targets | Android nativo |
| WCAG 2.2 SC 2.5.8 (AA) | 24×24 **px CSS**, con excepción de espaciado | Piso legal mínimo en web |
| WCAG 2.5.5 (AAA) | 44×44 px | Objetivo recomendado en web para controles primarios/de riesgo |

Las 5 excepciones de 2.5.8: inline (dentro de una línea de texto), equivalente (otro control hace lo mismo y sí cumple 24×24), controlado por el user agent, esencial (mapas, visualizaciones densas), espaciado suficiente (círculo de 24px de diámetro sin intersección entre centros).

### Motion (`prefers-reduced-motion`)

Toda animación disparada por interacción (hover, focus, scroll) que no sea esencial debe poder desactivarse y respetar `prefers-reduced-motion: reduce` — **2.3.3 (AAA)**, complementa a **2.2.2 Pause/Stop/Hide** (A) que cubre animación continua/autoplay. Von Restorff (`ux-doctrine` §2.4) ya advierte cuidado con el uso de movimiento por sensibilidad vestibular — este criterio es la contraparte normativa de esa advertencia de diseño.

---

## Resumen (10 líneas)

WCAG 2.2 (Recomendación W3C, oct. 2023) agrega 9 criterios nuevos sobre 2.1 — 6 de nivel A/AA obligatorios para un objetivo AA realista: Focus Not Obscured, Dragging Movements, Target Size Minimum (24×24px), Consistent Help, Redundant Entry y Accessible Authentication Minimum. APCA **no** es sucesor confirmado de la fórmula de contraste WCAG 2: fue removido del draft normativo de WCAG 3 en 2023 y sigue exploratorio; los verificadores deben seguir usando la fórmula de luminancia relativa WCAG 2. La automatización (axe-core) detecta **57.38%** de los problemas reales (80.39% con guía humana dirigida) — Deque, con base en 13.000+ páginas y ~300.000 issues analizados; el resto exige juicio humano: si un `alt` describe bien, si el orden de foco es lógico, si un error es comprensible. §4 documenta 22 reglas verificables en el esquema universal (id, defecto, porque_importa, deteccion, herramienta_existente, etc.): 15 ya están cubiertas por axe-core o eslint-plugin-vuejs-accessibility — el trabajo real es CONFIGURARLAS, no reimplementarlas. Solo 5 no tienen herramienta existente (foco-orden-ilogico, foco-no-visible, foco-obscurecido, reflow-320px, spa-foco-no-gestionado) y 1 se marca explícitamente `no-automatizable` (momento de anuncio de live region). El catálogo de axe-core tiene ~90 reglas activas repartidas en wcag2a/wcag2aa/wcag21aa/wcag22aa/best-practice/aaa/experimental/deprecated; `eslint-plugin-vuejs-accessibility` trae 23 reglas confirmadas contra su código fuente.

**Cifra de cobertura de automatización**: 57.38% (solo automatizado) / 80.39% (con Intelligent Guided Testing) — [Deque, Automated Testing Study](https://www.deque.com/blog/automated-testing-study-identifies-57-percent-of-digital-accessibility-issues/).

---

## Fuentes

| Fuente | URL |
|---|---|
| W3C — What's New in WCAG 2.2 | w3.org/WAI/standards-guidelines/wcag/new-in-22/ |
| W3C — WCAG 2.2 Quickref | w3.org/WAI/WCAG22/quickref/ |
| W3C — Understanding 1.4.3 Contrast Minimum | w3.org/WAI/WCAG22/Understanding/contrast-minimum.html |
| W3C — Understanding 1.4.11 Non-text Contrast | w3.org/WAI/WCAG22/Understanding/non-text-contrast.html |
| W3C — Understanding 1.4.10 Reflow | w3.org/WAI/WCAG22/Understanding/reflow.html |
| W3C — Understanding 2.5.8 Target Size Minimum | w3.org/WAI/WCAG22/Understanding/target-size-minimum.html |
| W3C — Understanding 1.3.5 Identify Input Purpose | w3.org/WAI/WCAG22/Understanding/identify-input-purpose.html |
| W3C — Understanding 2.4.7 Focus Visible | w3.org/WAI/WCAG22/Understanding/focus-visible.html |
| W3C — Understanding 2.4.3 Focus Order | w3.org/WAI/WCAG22/Understanding/focus-order.html |
| W3C — Understanding 2.1.1 Keyboard | w3.org/WAI/WCAG22/Understanding/keyboard.html |
| W3C — Using ARIA | w3.org/TR/using-aria/ |
| W3C — ARIA APG Read Me First | w3.org/WAI/ARIA/apg/practices/read-me-first/ |
| W3C — ARIA APG, patrones de diseño | w3.org/WAI/ARIA/apg/patterns/ |
| Deque — Automated Testing Study | deque.com/blog/automated-testing-study-identifies-57-percent-of-digital-accessibility-issues/ |
| axe-core — rule-descriptions.md | github.com/dequelabs/axe-core/blob/master/doc/rule-descriptions.md |
| eslint-plugin-vuejs-accessibility | github.com/vue-a11y/eslint-plugin-vuejs-accessibility |
| WebAIM — Screen Reader Survey #10 | webaim.org/projects/screenreadersurvey10/ |
| Adrian Roselli — WCAG3 Contrast as of April 2026 | adrianroselli.com/2026/04/wcag3-contrast-as-of-april-2026.html |
| MDN — aria-label / aria-labelledby | developer.mozilla.org (aria-labelledby) |
| MDN / W3C — status role, alert role | developer.mozilla.org (status_role, alert_role) |
| Apple Human Interface Guidelines | developer.apple.com/design/human-interface-guidelines/ |
| Material Design 3 / Android Accessibility Help | m3.material.io, support.google.com/accessibility/android |
