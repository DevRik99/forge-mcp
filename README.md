# forge-mcp

MCP **director** del pipeline forge, para el modo **Claude-ejecutor**.

## Qué es

El backend forge (NestJS en la VPS) corre el pipeline de forma autónoma con *workers* baratos (MiniMax /
cc-fleet / opencode-go): dispatch, reintentos, checkpoints por proceso caído. Este MCP es un **camino
alternativo**, pensado para correr el mismo pipeline dentro de una sesión de Claude Code, sin backend:

- El MCP **dice qué fase toca** y qué se espera de ella, con el **mismo criterio real** que usaría un
  worker del backend (el `systemPrompt` de cada fase es el prompt textual portado de
  `backend-nodes-export.json`, no un resumen).
- Claude **ejecuta** la fase — a veces con subagentes, a veces con el usuario (`clarify` es una
  decisión de producto, no de Claude).
- Claude **reporta** la fase hecha con `forge_complete_phase`; el MCP valida y **avanza** a la siguiente.
- No se puede saltar fases ni terminar antes de cerrarlas todas (salvo `deliver`, opcional).

El estado se persiste en **SQLite** (`node:sqlite`, nativo de Node, sin `better-sqlite3` ni compilación)
para **reanudar en cualquier sesión**: el contexto de Claude no sobrevive a un cierre, una compactación
o retomar al día siguiente — el estado del flujo sí.

## Fases

```
classify → clarify → setup → design → plan → build → gates → qa → deliver
```

Definidas en `src/phases.ts`. Cada fase trae `goal` (instrucción corta), `systemPrompt` (el criterio
completo portado del nodo equivalente del backend), `skills` (qué cargar antes de ejecutarla) y
`needsUser` (si involucra una decisión que Claude debe llevarle al usuario, no tomar solo).

| Fase | Qué hace | needsUser | Skills que carga |
|---|---|:-:|---|
| `classify` | Clasifica la naturaleza del pedido: QUESTION / MICRO / STANDARD / HIGH-RISK, con razón y riesgos. | no | — |
| `clarify` | Detecta ambigüedades que cambiarían el producto si se adivinan mal; las de severidad HIGH van al usuario con opciones y consecuencia; el resto se resuelve con criterio declarando el supuesto. | **sí** | — |
| `setup` | Decide el stack y sus versiones REALES vía herramientas (`npm view`, CLIs oficiales de integración) — nunca de memoria. Deja el proyecto scaffoldeado, con deps instaladas y linter estricto, todo por CLI. | no | — |
| `design` | Brainstorm de la solución + brief de diseño UX/UI (sistema, no wireframes vagos) + plan de QA con criterios de aceptación y edge cases + guía de calidad de código. Documentos que persisten como artefactos. | no | `brainstorming`, `continuous-discovery`, `jobs-to-be-done`, `impeccable`, `design-an-interface`, `design-taste-frontend` |
| `plan` | Descompone el trabajo en tareas atómicas con ownership de archivos disjunto (método Depth Tree del skill `unlazy`, profundidad 8), agrupadas en bloques independientes paralelizables, cada una con su instrucción como objetivo (qué y por qué, no un paso a paso rígido). | no | `unlazy` |
| `build` | Implementa las tareas del plan: lee el código existente antes de tocarlo (nunca reescribe un archivo entero — preserva lo que ya construyeron fases previas), reutiliza en vez de reinventar, respeta el linter estricto sin silenciarlo. | no | `frontend-design`, `design-taste-frontend`, `tailwind-4` |
| `gates` | Corre los gates reales del repo (lint estricto + build + tests) tal como el proyecto los define. La verdad es el exit code, no la autopercepción del modelo. Si algo está rojo, arregla la causa y reintenta hasta verde. | no | `code-quality-master`, `clean-code`, `refactoring-ui` |
| `qa` | Verificación real en dos fases: (1) confirmar que la app hace lo pedido de punta a punta (correrla, ejercitar el flujo real), (2) atacarla — inputs raros, límites, XSS, estados imposibles — y reportar qué rompió. | no | `playwright-master`, `qa-master`, `browser-qa` |
| `deliver` (opcional) | Publica según lo que el pedido realmente necesita (push a remoto, deploy). Nunca reporta "online" sin URL real; si no aplica, se salta explícitamente con la razón. | no | — |

## La enciclopedia de skills (128)

`src/skills.ts` + la carpeta `skills/` (128 subcarpetas, cada una con su `SKILL.md`, copiadas y
versionadas del arsenal del backend — este MCP **no depende del backend** para esto, es autónomo).

- `SKILL_MAP` fija, por dominio, qué skills carga cada fase (portado 1:1 del `SKILL_MAP` del backend):
  `brainstorm`, `design`, `frontend`, `quality`, `qa`, `monetization`, `product`.
- Además de las que ya trae fijas cada `Phase` en `phases.ts`, el dominio se puede consultar aparte con
  la tool `forge_skills(phase)` para casos que no mapean 1:1 a una fase del pipeline (por ejemplo,
  `monetization` o `product`, que hoy no tienen fase dedicada pero sí quedan disponibles bajo demanda).
- Las skills se cargan **bajo demanda**, nunca todas juntas: Claude pide la lista con `forge_skills` y
  el contenido puntual con `forge_skill(name)` solo de las que la fase actual necesita.

## Tools (7)

| Tool | Qué hace |
|---|---|
| `forge_start(request, cwd)` | Arranca un run nuevo; devuelve la primera fase (`classify`) y su objetivo. |
| `forge_status(runId?)` | En qué fase está un run y su progreso (`[x]` cerradas, `[>]` actual, `[ ]` pendientes). `runId` opcional si hay un solo run activo. |
| `forge_next(runId?)` | La fase ACTUAL con su objetivo detallado, `systemPrompt` completo y skills a cargar. Se usa cuando no está claro qué sigue. |
| `forge_complete_phase(runId?, summary)` | Cierra la fase actual con el resumen de lo hecho/decidido (se persiste como artefacto) y avanza a la siguiente. Si era la última, marca el run `done`. |
| `forge_tasks()` | Lista los runs activos — para reanudar desde cualquier sesión sin releer contexto. |
| `forge_skills(phase?)` | Lista el arsenal completo de skills, o filtrado por dominio (`SKILL_MAP`) si se pasa `phase`. |
| `forge_skill(name)` | Devuelve el contenido del `SKILL.md` de una skill puntual, para que Claude la cargue y aplique en la fase actual. |

Nombres reales de las tools en `src/server.ts` (el README viejo usaba nombres en español —
`forge_iniciar`/`forge_estado`/etc. — que no coinciden con el código; los de esta tabla sí).

## Uso

```bash
npm install
npm run build
node dist/server.js   # sirve por stdio (lo lanza el cliente MCP)
```

Registrar en Claude Code (`.mcp.json` o config del proyecto):

```json
{ "mcpServers": { "forge": { "command": "node", "args": ["dist/server.js"] } } }
```

## Cómo se reanuda

El estado vive en `forge-mcp.db` (SQLite, ruta configurable con `FORGE_MCP_DB`), en dos tablas:

- `runs`: un row por run (`id`, `request`, `cwd`, `current_phase`, `status`, timestamps).
- `phase_artifacts`: un row por fase cerrada de cada run (`run_id`, `phase`, `summary`, `closed_at`) —
  el resumen que Claude reportó al cerrarla, o sea la decisión/artefacto real, no solo un flag booleano.

Al perder la sesión (cierre, compactación, otro día), cualquier sesión nueva de Claude con este MCP
conectado puede:

1. Llamar `forge_tasks()` para ver qué runs quedaron activos y en qué fase.
2. Llamar `forge_next(runId)` para recibir nuevamente el `systemPrompt` completo de la fase actual — no
   hace falta que Claude recuerde nada del contexto anterior, el MCP se lo vuelve a dar tal cual.
3. Los artefactos de las fases ya cerradas (`phase_artifacts`) quedan disponibles vía `forge_status`
   como historial de lo ya decidido, para no repreguntar lo que el usuario ya resolvió en `clarify`.

## Comparación honesta con el backend

| Aspecto | Backend (NestJS + VPS) | forge-mcp |
|---|---|---|
| Ejecutor de cada fase | Workers baratos (MiniMax / cc-fleet / opencode-go) con dispatch y fallback | **Claude** (con subagentes si hace falta), dentro de la misma sesión |
| Máquina de estados de fases | Sí (nodos del pipeline) | Sí — mismo orden, mismo criterio (`systemPrompt` portado textual) |
| Persistencia para reanudar | Sí (DB propia + checkpoints por commit) | Sí (SQLite: runs + artefactos por fase) |
| Enciclopedia de skills por fase (SKILL_MAP) | Sí | Sí — portado 1:1, 128 skills propias versionadas en el repo |
| Dispatch/reintento de workers caídos | Sí (liveness, idle-timeout, fallback a cc-fleet) | **No aplica** — no hay workers que se caigan, el ejecutor es Claude |
| Paralelización de bloques del plan | Sí (bloques independientes en paralelo, con reconciliación) | **No** — el MCP entrega los bloques del plan pero no orquesta paralelismo real; Claude decide si usa subagentes |
| Scoreboard de modelos / costo por run | Sí | **No** — no hay múltiples proveedores que comparar |
| Notificación de progreso (Telegram/Hermes) | Sí | **No** |
| CI/CD, deploy a VPS, Portainer | Sí | **No** — la fase `deliver` es una instrucción para que Claude publique, no una integración |
| Interfaz de uso | n8n / API HTTP propia | Tools MCP llamadas naturalmente desde Claude Code |

En resumen: el MCP replica fielmente la **secuencia de fases, el criterio de cada una y la enciclopedia
de skills** del backend, pero no reemplaza su capa de orquestación pesada (dispatch de workers,
paralelización real, notificaciones, CI/CD). Es un modo liviano para correr el mismo pipeline con
Claude como único ejecutor, útil cuando no hay backend disponible o cuando se prefiere que sea Claude
—no un worker barato— quien escriba el código.
