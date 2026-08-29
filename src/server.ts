/**
 * Servidor MCP forge — el DIRECTOR del pipeline para el modo Claude-ejecutor.
 *
 * No ejecuta nada del trabajo: Claude ejecuta cada fase. El MCP solo (1) dice qué fase toca y qué se
 * espera de ella, (2) valida que Claude cierre la fase actual antes de avanzar, (3) persiste el estado
 * para reanudar en cualquier sesión. Es la máquina de estados del flujo, expuesta como tools que Claude
 * llama de forma natural.
 *
 * Tools:
 *  - forge_iniciar(request, cwd)   → arranca un run nuevo; devuelve la primera fase y su objetivo.
 *  - forge_estado(runId?)          → en qué fase está un run (o el único activo); qué se hizo y qué falta.
 *  - forge_siguiente(runId?)       → la fase ACTUAL con su objetivo detallado (qué hacer ahora).
 *  - forge_completar_fase(runId, resumen) → cierra la fase actual con su artefacto y avanza a la siguiente.
 *  - forge_tareas()                → lista los runs activos (para reanudar desde cualquier sesión).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { PHASES, findPhase } from './phases.js';
import { Store, nextPhaseId, type Run } from './store.js';

/** Texto de una fase para devolvérselo a Claude: qué toca hacer y qué cierra la fase. */
function describePhase(phaseId: string): string {
  const phase = findPhase(phaseId);
  if (!phase) return `Fase desconocida: ${phaseId}`;
  const userNote = phase.needsUser
    ? '\n⚠️ Esta fase involucra una DECISIÓN DEL USUARIO: trae las preguntas al usuario, no decidas solo.'
    : '';
  return (
    `FASE: ${phase.title} (${phase.id})\n` +
    `OBJETIVO: ${phase.goal}\n` +
    `CIERRA CON: ${phase.produces}${userNote}\n\n` +
    `Cuando termines, llama forge_completar_fase con un resumen de lo que hiciste/decidiste.`
  );
}

/** Progreso de un run: fases cerradas, fase actual, fases restantes. */
function progressOf(store: Store, run: Run): string {
  const artifacts = store.artifactsOf(run.id);
  const doneIds = new Set(artifacts.map((a) => a.phase));
  const lines = PHASES.map((phase) => {
    if (doneIds.has(phase.id)) return `✓ ${phase.title}`;
    if (phase.id === run.currentPhase) return `▶ ${phase.title} (AQUÍ)`;
    return `· ${phase.title}`;
  });
  return lines.join('\n');
}

export function buildServer(store: Store, now: () => number): McpServer {
  const server = new McpServer({ name: 'forge', version: '0.1.0' });

  server.registerTool(
    'forge_iniciar',
    {
      description:
        'Arranca un run nuevo del pipeline forge para un pedido. Devuelve la primera fase (clasificar) y su objetivo. A partir de aquí, sigue el flujo fase por fase usando forge_siguiente y forge_completar_fase — no te saltes fases.',
      inputSchema: {
        request: z.string().describe('El pedido del usuario, textual.'),
        cwd: z
          .string()
          .describe('Directorio del proyecto donde se ejecuta el pipeline.'),
      },
    },
    async ({ request, cwd }) => {
      const runId = `run-${now()}`;
      const run = store.createRun(runId, request, cwd, now());
      return {
        content: [
          {
            type: 'text',
            text:
              `Run ${runId} iniciado.\n\n${describePhase(run.currentPhase)}\n\n` +
              `— El pipeline forge te guía fase por fase. No escribas código ni termines hasta cerrar todas las fases con forge_completar_fase.`,
          },
        ],
      };
    },
  );

  server.registerTool(
    'forge_estado',
    {
      description:
        'Muestra en qué fase está un run y su progreso (qué se hizo, qué falta). Si no das runId y hay un solo run activo, usa ese.',
      inputSchema: {
        runId: z
          .string()
          .optional()
          .describe('Id del run; opcional si hay uno solo activo.'),
      },
    },
    async ({ runId }) => {
      const run = resolveRun(store, runId);
      if (!run) return notFound(runId);
      return {
        content: [
          {
            type: 'text',
            text:
              `Run ${run.id} — ${run.status}\nPedido: ${run.request}\n\nProgreso:\n${progressOf(store, run)}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    'forge_siguiente',
    {
      description:
        'Devuelve la fase ACTUAL con su objetivo detallado: qué debes hacer ahora. Llama esto cuando no sepas qué sigue.',
      inputSchema: {
        runId: z
          .string()
          .optional()
          .describe('Id del run; opcional si hay uno solo activo.'),
      },
    },
    async ({ runId }) => {
      const run = resolveRun(store, runId);
      if (!run) return notFound(runId);
      if (run.status === 'done') {
        return {
          content: [
            { type: 'text', text: `Run ${run.id} ya terminó todas sus fases.` },
          ],
        };
      }
      return { content: [{ type: 'text', text: describePhase(run.currentPhase) }] };
    },
  );

  server.registerTool(
    'forge_completar_fase',
    {
      description:
        'Cierra la fase ACTUAL con un resumen de lo que hiciste/decidiste, y avanza a la siguiente. El resumen se persiste (para reanudar). No cierres una fase sin haberla hecho de verdad.',
      inputSchema: {
        runId: z
          .string()
          .optional()
          .describe('Id del run; opcional si hay uno solo activo.'),
        summary: z
          .string()
          .describe(
            'Qué hiciste/decidiste en esta fase (el artefacto que la da por cerrada).',
          ),
      },
    },
    async ({ runId, summary }) => {
      const run = resolveRun(store, runId);
      if (!run) return notFound(runId);
      if (run.status === 'done') {
        return {
          content: [{ type: 'text', text: `Run ${run.id} ya terminó.` }],
        };
      }
      const next = nextPhaseId(run.currentPhase);
      if (next === null) {
        store.closePhaseAndAdvance(
          run.id,
          run.currentPhase,
          summary,
          run.currentPhase,
          now(),
        );
        store.finishRun(run.id, now());
        return {
          content: [
            {
              type: 'text',
              text: `Fase "${run.currentPhase}" cerrada. Era la última — run ${run.id} COMPLETO. Todas las fases del pipeline pasaron.`,
            },
          ],
        };
      }
      store.closePhaseAndAdvance(run.id, run.currentPhase, summary, next, now());
      return {
        content: [
          {
            type: 'text',
            text: `Fase "${run.currentPhase}" cerrada. Ahora:\n\n${describePhase(next)}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    'forge_tareas',
    {
      description:
        'Lista los runs activos del pipeline (para reanudar desde cualquier sesión). Muestra id, pedido y fase actual.',
      inputSchema: {},
    },
    async () => {
      const runs = store.activeRuns();
      if (runs.length === 0) {
        return {
          content: [{ type: 'text', text: 'No hay runs activos.' }],
        };
      }
      const lines = runs.map(
        (run) =>
          `- ${run.id} · fase ${run.currentPhase} · ${run.request.slice(0, 60)}`,
      );
      return {
        content: [
          {
            type: 'text',
            text: `Runs activos (${runs.length}):\n${lines.join('\n')}\n\nReanuda uno con forge_siguiente runId=<id>.`,
          },
        ],
      };
    },
  );

  return server;
}

/** Resuelve el run por id, o el único activo si no se da id. */
function resolveRun(store: Store, runId?: string): Run | null {
  if (runId) return store.getRun(runId);
  const active = store.activeRuns();
  return active.length === 1 ? active[0] : null;
}

function notFound(runId?: string): {
  content: { type: 'text'; text: string }[];
} {
  return {
    content: [
      {
        type: 'text',
        text: runId
          ? `No hay un run con id ${runId}.`
          : 'No se pudo inferir el run (hay varios o ninguno activo). Pasa runId, o mira forge_tareas.',
      },
    ],
  };
}

/** Arranque: abre el store y sirve por stdio (como lo lanza el cliente MCP). */
async function main(): Promise<void> {
  const dbPath = process.env.FORGE_MCP_DB ?? 'forge-mcp.db';
  const store = new Store(dbPath);
  const server = buildServer(store, () => Date.now());
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  process.stderr.write(
    `forge-mcp fatal: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
