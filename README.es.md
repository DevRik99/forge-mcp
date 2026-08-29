# forge-mcp

**El director del pipeline forge.** Un servidor MCP que le dice a Claude Code *qué fase toca
y qué debe producir*, y valida la evidencia antes de dejar avanzar el flujo. **Claude es el
ejecutor** — forge nunca hace el trabajo por sí mismo. Dirige, y tú construyes.

🇬🇧 [Read it in English](./README.md)

---

## La idea

Un trabajo largo — diseñar una feature, construirla, testearla, publicarla — es fácil de
hacer en desorden, de saltarse un paso, o de declarar "listo" sin prueba. forge convierte ese
flujo en un **pipeline de fases** que solo puede avanzar en orden, y solo cuando cada fase
entrega evidencia real.

- forge **dice qué fase sigue** y exactamente qué espera de ella (el criterio completo, no un
  resumen).
- **Tú (Claude) ejecutas** la fase — leyendo código, escribiéndolo, corriendo tests,
  preguntándole al usuario cuando la decisión es suya.
- **Reportas la fase hecha** con evidencia; forge la **valida** y **avanza**.
- **No puedes saltar una fase**, ni cerrar una con evidencia vacía o inventada, ni terminar
  antes de cerrar todas.

El estado vive en **SQLite** (`node:sqlite`, nativo de Node — sin paso de compilación), así
que un run **se reanuda en cualquier sesión**: el contexto de Claude no sobrevive a un cierre,
una compactación o retomar al día siguiente — el estado del flujo sí.

---

## Las 13 fases

```
classify → clarify → setup → precondition → design → plan → build
        → gates → qa → reconcile → contraste → reflect → deliver
```

| Fase | Qué hace | Pregunta al usuario | Opcional |
|---|---|:-:|:-:|
| `classify` | Clasifica la naturaleza del pedido (QUESTION / MICRO / STANDARD / HIGH-RISK) y su alcance. | | |
| `clarify` | Detecta ambigüedades que cambian el producto; lleva las importantes al usuario con opciones y consecuencias. | **sí** | |
| `setup` | Decide el stack y sus versiones REALES (vía `npm view` / CLIs oficiales, nunca de memoria); scaffold, instala deps, linter estricto. | | |
| `precondition` | Verifica que las condiciones para empezar el build de forma segura estén cumplidas (herramientas presentes, entorno listo). | | |
| `design` | Antes de codear: brainstorm de la solución, un brief de diseño UX/UI, un plan de QA con edge cases, una guía de calidad — persistidos como artefactos. | | |
| `plan` | Descompone el trabajo en tareas atómicas con ownership de archivos disjunto, agrupadas en bloques independientes. | | |
| `build` | Implementa el plan. Tú construyes — reutilizando lo que existe, sin reescribir un archivo entero, respetando el linter estricto. | | |
| `gates` | Corre los gates reales del repo (lint estricto + build + tests). La verdad es el exit code, no la autopercepción del modelo. | | |
| `qa` | Verifica de verdad: corre la app de punta a punta, y después la ATACA (inputs raros, límites, estados imposibles) y reporta qué rompió. | | |
| `reconcile` | Solo si el trabajo en paralelo pudo duplicar lógica o crear conflictos — los resuelve. | | **sí** |
| `contraste` | Una revisión independiente que NO conoce el veredicto de QA, explorando el build terminado con ojos frescos. | | |
| `reflect` | Mira hacia atrás cómo fue este run (qué pasó, qué falló) y extrae lecciones. | | |
| `deliver` | Publica según el pedido (push a remoto, deploy). Nunca reporta "online" sin una URL real; se salta explícitamente con una razón si no aplica. | | **sí** |

Cada fase trae un `goal` (instrucción corta), un `systemPrompt` completo (el criterio completo
de esa fase), las `skills` a cargar antes de ejecutarla, y flags de si necesita al usuario o es
opcional. Todo definido en `src/phases.ts`.

---

## La evidencia se valida, no se confía

forge no acepta "listo" como un string. `forge_complete_phase` valida la **evidencia** que
cada fase debe entregar, y rechaza el cierre si no se sostiene:

- `gates` exige los exit codes reales (lint / build / test) y todos deben ser `0`.
- `qa` exige un resultado estructurado: pasó, y realmente fue atacada.
- `clarify` (una decisión del usuario) exige un `userConfirmed` explícito.
- Una fase **opcional** solo se puede saltar con una razón declarada.

Así una fase no se puede cerrar con un resumen inventado. El pipeline avanza con prueba.

---

## La enciclopedia de skills (128)

`src/skills.ts` + la carpeta `skills/` traen 128 skills, cada una con su `SKILL.md`,
versionadas en el repo (forge es autocontenido — no depende de nada externo para esto). Cada
fase declara qué skills carga; el mapa de dominios (`SKILL_MAP`) dice qué skills pertenecen a
qué dominio. Las skills se cargan **bajo demanda** — Claude pide la lista con `forge_skills` y
el contenido de una puntual con `forge_skill(name)`, nunca todas juntas.

---

## Las 7 tools

| Tool | Qué hace |
|---|---|
| `forge_start(request, cwd)` | Arranca un run nuevo; devuelve la primera fase (`classify`) y su objetivo. |
| `forge_status(runId?)` | En qué fase está un run y su progreso (`[x]` cerradas, `[>]` actual, `[ ]` pendientes). |
| `forge_next(runId?)` | La fase ACTUAL con su objetivo detallado, el `systemPrompt` completo y las skills a cargar. |
| `forge_complete_phase(runId?, summary, evidence)` | Cierra la fase actual con un resumen y la evidencia validada, y avanza. Si era la última, marca el run `done`. |
| `forge_tasks()` | Lista los runs activos — para reanudar desde cualquier sesión sin releer contexto. |
| `forge_skills(phase?)` | Lista la enciclopedia completa de skills, o filtrada por dominio si se pasa una fase. |
| `forge_skill(name)` | Devuelve el `SKILL.md` de una skill puntual para que Claude la cargue y aplique. |

---

## Instalación

```bash
git clone https://github.com/DevRik99/forge-mcp
cd forge-mcp
npm install
npm run build
```

Registrarlo en Claude Code (`.mcp.json` o config del proyecto):

```json
{ "mcpServers": { "forge": { "command": "node", "args": ["dist/server.js"] } } }
```

Requiere **Node ≥ 22.5** (por `node:sqlite`).

---

## Cómo se reanuda un run

El estado vive en una única DB **global** de SQLite en `~/.forge/forge-mcp.db` (se sobrescribe
con `FORGE_MCP_DB`), así que todos los proyectos comparten un solo store y los runs se
distinguen por su `cwd`. Dos tablas:

- `runs`: un row por run (`id`, `request`, `cwd`, `current_phase`, `status`, timestamps).
- `phase_artifacts`: un row por fase cerrada (`run_id`, `phase`, `summary`, `closed_at`) — la
  decisión/artefacto real que Claude reportó, no solo un flag booleano.

Tras perder la sesión (cierre, compactación, otro día), cualquier sesión nueva de Claude con
este MCP conectado puede:

1. Llamar `forge_tasks()` para ver qué runs quedaron activos y en qué fase.
2. Llamar `forge_next(runId)` para recibir de nuevo el `systemPrompt` completo de la fase
   actual — Claude no necesita recordar nada; forge se lo vuelve a dar tal cual.
3. Leer los artefactos de las fases cerradas vía `forge_status`, para no repreguntar lo que ya
   se decidió (por ejemplo en `clarify`).

---

## Garantías (y límites honestos)

forge **fuerza**: el orden de fases, cerrar cada fase antes de terminar, y evidencia validada
por fase (sin `gates`/`qa` falsos, sin saltar decisiones del usuario ni fases opcionales sin
razón). Bajo concurrencia, cerrar una fase es atómico — un doble-cierre viejo se rechaza, no se
aplica en silencio.

forge **no puede** impedir que edites el proyecto *sin* usarlo — un MCP solo ve sus propias
tools, no tus `Edit`/`Write`/`Bash`. Para forzar que cada cambio pase por el pipeline,
combínalo con el gate `forge-flow` de
[claude-gates](https://github.com/DevRik99/claude-gates), que bloquea las ediciones cuando no
hay un run de forge activo.

## Licencia

MIT.
