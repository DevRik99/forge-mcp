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
  if (!phase) return `Unknown phase: ${phaseId}`;
  const userNote = phase.needsUser
    ? '\nThis phase involves a USER DECISION: bring the questions to the user, do not decide alone.'
    : '';
  return (
    `PHASE: ${phase.title} (${phase.id})\n` +
    `GOAL: ${phase.goal}\n` +
    `CLOSES WITH: ${phase.produces}${userNote}\n\n` +
    `When done, call forge_completar_fase with a summary of what you did/decided.`
  );
}

/** Progreso de un run: fases cerradas, fase actual, fases restantes. */
function progressOf(store: Store, run: Run): string {
  const artifacts = store.artifactsOf(run.id);
  const doneIds = new Set(artifacts.map((a) => a.phase));
  const lines = PHASES.map((phase) => {
    if (doneIds.has(phase.id)) return `[x] ${phase.title}`;
    if (phase.id === run.currentPhase) return `[>] ${phase.title} (HERE)`;
    return `[ ] ${phase.title}`;
  });
  return lines.join('\n');
}

export function buildServer(store: Store, now: () => number): McpServer {
  const server = new McpServer({ name: 'forge', version: '0.1.0' });

  // Arranca un run nuevo del pipeline y devuelve la primera fase.
  server.registerTool(
    'forge_iniciar',
    {
      description:
        'Start a new forge pipeline run for a request. Returns the first phase (classify) and its goal. From here, follow the flow phase by phase using forge_siguiente and forge_completar_fase — do not skip phases.',
      inputSchema: {
        request: z.string().describe("The user's request, verbatim."),
        cwd: z.string().describe('Project directory where the pipeline runs.'),
      },
    },
    ({ request, cwd }) => {
      const runId = `run-${String(now())}`;
      const run = store.createRun(runId, request, cwd, now());
      return {
        content: [
          {
            type: 'text',
            text:
              `Run ${runId} started.\n\n${describePhase(run.currentPhase)}\n\n` +
              `— The forge pipeline guides you phase by phase. Do not write code or finish until every phase is closed with forge_completar_fase.`,
          },
        ],
      };
    },
  );

  // En qué fase está un run y su progreso.
  server.registerTool(
    'forge_estado',
    {
      description:
        'Shows which phase a run is in and its progress (done / pending). If no runId is given and exactly one run is active, uses that one.',
      inputSchema: {
        runId: z
          .string()
          .optional()
          .describe('Run id; optional when exactly one run is active.'),
      },
    },
    ({ runId }) => {
      const run = resolveRun(store, runId);
      if (!run) return notFound(runId);
      return {
        content: [
          {
            type: 'text',
            text: `Run ${run.id} — ${run.status}\nRequest: ${run.request}\n\nProgress:\n${progressOf(store, run)}`,
          },
        ],
      };
    },
  );

  // La fase actual con su objetivo detallado.
  server.registerTool(
    'forge_siguiente',
    {
      description:
        'Returns the CURRENT phase with its detailed goal: what to do now. Call this when you are unsure what comes next.',
      inputSchema: {
        runId: z
          .string()
          .optional()
          .describe('Run id; optional when exactly one run is active.'),
      },
    },
    ({ runId }) => {
      const run = resolveRun(store, runId);
      if (!run) return notFound(runId);
      if (run.status === 'done') {
        return {
          content: [
            {
              type: 'text',
              text: `Run ${run.id} already finished all phases.`,
            },
          ],
        };
      }
      return {
        content: [{ type: 'text', text: describePhase(run.currentPhase) }],
      };
    },
  );

  // Cierra la fase actual y avanza a la siguiente.
  server.registerTool(
    'forge_completar_fase',
    {
      description:
        'Closes the CURRENT phase with a summary of what you did/decided, and advances to the next one. The summary is persisted (for resuming). Do not close a phase you have not actually done.',
      inputSchema: {
        runId: z
          .string()
          .optional()
          .describe('Run id; optional when exactly one run is active.'),
        summary: z
          .string()
          .describe(
            'What you did/decided in this phase (the artifact that closes it).',
          ),
      },
    },
    ({ runId, summary }) => {
      const run = resolveRun(store, runId);
      if (!run) return notFound(runId);
      if (run.status === 'done') {
        return {
          content: [{ type: 'text', text: `Run ${run.id} already finished.` }],
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
              text: `Phase "${run.currentPhase}" closed. It was the last one — run ${run.id} COMPLETE. Every pipeline phase passed.`,
            },
          ],
        };
      }
      store.closePhaseAndAdvance(
        run.id,
        run.currentPhase,
        summary,
        next,
        now(),
      );
      return {
        content: [
          {
            type: 'text',
            text: `Phase "${run.currentPhase}" closed. Now:\n\n${describePhase(next)}`,
          },
        ],
      };
    },
  );

  // Lista los runs activos (para reanudar desde cualquier sesión).
  server.registerTool(
    'forge_tareas',
    {
      description:
        'Lists the active pipeline runs (to resume from any session). Shows id, request and current phase.',
      inputSchema: {},
    },
    () => {
      const runs = store.activeRuns();
      if (runs.length === 0) {
        return {
          content: [{ type: 'text', text: 'No active runs.' }],
        };
      }
      const lines = runs.map(
        (run) =>
          `- ${run.id} · phase ${run.currentPhase} · ${run.request.slice(0, 60)}`,
      );
      return {
        content: [
          {
            type: 'text',
            text: `Active runs (${String(runs.length)}):\n${lines.join('\n')}\n\nResume one with forge_siguiente runId=<id>.`,
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

/** Respuesta cuando no se encuentra el run pedido. */
function notFound(runId?: string): {
  content: { type: 'text'; text: string }[];
} {
  return {
    content: [
      {
        type: 'text',
        text: runId
          ? `No run with id ${runId}.`
          : 'Could not infer the run (several or none active). Pass runId, or check forge_tareas.',
      },
    ],
  };
}

/** Arranque: abre el store y sirve por stdio (como lo lanza el cliente MCP). */
async function main(): Promise<void> {
  const databasePath = process.env.FORGE_MCP_DB ?? 'forge-mcp.db';
  const store = new Store(databasePath);
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
