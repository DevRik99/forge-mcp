# forge-mcp

MCP **director** del pipeline forge, para el modo **Claude-ejecutor**.

## Qué es

El backend forge (NestJS en la VPS) corre el pipeline de forma autónoma con *workers* baratos (MiniMax /
cc-fleet). Este MCP es un **camino alternativo**: el pipeline lo conduce el MCP, pero el **ejecutor de
cada fase es Claude** (con subagentes), no los workers.

- El MCP **dice qué fase toca** y qué se espera de ella.
- Claude **ejecuta** la fase (a veces con el usuario, como en `clarify`).
- Claude **reporta** la fase hecha; el MCP valida y **avanza**.
- No se puede saltar fases ni terminar antes de cerrarlas todas.

El estado se persiste en **SQLite** (`node:sqlite`, sin compilación) para **reanudar en cualquier
sesión**: el contexto de Claude no sobrevive a un cierre/compactación, pero el estado del flujo sí.

## Fases

`classify → clarify → setup → design → plan → build → gates → qa → deliver`
(ver `src/phases.ts`; `deliver` es opcional).

## Tools

| Tool | Qué hace |
|------|----------|
| `forge_iniciar(request, cwd)` | Arranca un run; devuelve la primera fase. |
| `forge_estado(runId?)` | En qué fase está y su progreso. |
| `forge_siguiente(runId?)` | La fase actual con su objetivo (qué hacer ahora). |
| `forge_completar_fase(runId?, summary)` | Cierra la fase actual y avanza. |
| `forge_tareas()` | Runs activos (para reanudar desde cualquier sesión). |

## Uso

```bash
npm install
npm run build
node dist/server.js   # sirve por stdio (lo lanza el cliente MCP)
```

Registrar en Claude Code (`.mcp.json` o config):

```json
{ "mcpServers": { "forge": { "command": "node", "args": ["dist/server.js"] } } }
```

El estado vive en `forge-mcp.db` (configurable con `FORGE_MCP_DB`).

## No incluye

Dispatch de workers ni reanudación de procesos caídos: eso es del backend pesado. Aquí el ejecutor es
Claude, que no se cae como un worker — solo se persiste el estado del **flujo**.
