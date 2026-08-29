#!/usr/bin/env node
/**
 * Servidor MCP forge — el DIRECTOR del pipeline para el modo Claude-ejecutor.
 *
 * No ejecuta nada del trabajo: Claude ejecuta cada fase. El MCP solo (1) dice qué fase toca y qué se
 * espera de ella, (2) valida que Claude cierre la fase actual antes de avanzar, (3) persiste el estado
 * para reanudar en cualquier sesión. Es la máquina de estados del flujo, expuesta como tools que Claude
 * llama de forma natural.
 *
 * Tools:
 *  - forge_start(request, cwd)   → arranca un run nuevo; devuelve la primera fase y su objetivo.
 *  - forge_status(runId?)          → en qué fase está un run (o el único activo); qué se hizo y qué falta.
 *  - forge_next(runId?)       → la fase ACTUAL con su objetivo detallado (qué hacer ahora).
 *  - forge_complete_phase(runId, resumen) → cierra la fase actual con su artefacto y avanza a la siguiente.
 *  - forge_tasks()                → lista los runs activos (para reanudar desde cualquier sesión).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { pathToFileURL } from 'node:url';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { PHASES, findPhase } from './phases.js';
import { Store, nextPhaseId, StalePhaseError, type Run } from './store.js';
import { listSkills, skillsForPhase, readSkill } from './skills.js';

/** Texto de una fase para devolvérselo a Claude: qué toca hacer y qué cierra la fase. */
function describePhase(phaseId: string): string {
  const phase = findPhase(phaseId);
  if (!phase) return `Unknown phase: ${phaseId}`;
  const userNote = phase.needsUser
    ? '\nThis phase involves a USER DECISION: bring the questions to the user, do not decide alone.'
    : '';
  const skillsNote =
    phase.skills.length > 0
      ? `\nSKILLS: load these before executing — ${phase.skills.join(', ')}`
      : '';
  return (
    `PHASE: ${phase.title} (${phase.id})\n` +
    `GOAL: ${phase.goal}\n` +
    `CLOSES WITH: ${phase.produces}${userNote}${skillsNote}\n\n` +
    `SYSTEM PROMPT (execute this phase with this exact criterion):\n${phase.systemPrompt}\n\n` +
    `When done, call forge_complete_phase with a summary of what you did/decided.`
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

/** Input crudo (ya parseado por zod) de `forge_complete_phase`. */
interface CompletePhaseInput {
  runId?: string;
  summary: string;
  evidence?: Record<string, unknown>;
}

/** Respuesta MCP de texto simple, opcionalmente marcada como error. */
interface TextResult {
  [key: string]: unknown;
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

/** Arma una respuesta de rechazo (isError) con un mensaje accionable. */
function rejection(text: string): TextResult {
  return { content: [{ type: 'text', text }], isError: true };
}

/**
 * Handler PURO de `forge_complete_phase`, extraído para poder testearlo sin transporte MCP.
 * Valida, en orden: needsUser (requiere evidence.userConfirmed===true), optional+skipped (requiere
 * evidence.reason no trivial), y completionSchema de la fase (si tiene uno) contra `evidence`. Solo si
 * todo pasa, avanza el run. `summary` ya viene validado (.min(10)) por el inputSchema de la tool.
 */
export function completePhaseHandler(
  store: Store,
  now: () => number,
  input: CompletePhaseInput,
): TextResult {
  const { runId, summary, evidence } = input;
  const run = resolveRun(store, runId);
  if (!run) return notFound(runId);
  if (run.status === 'done') {
    return {
      content: [{ type: 'text', text: `Run ${run.id} already finished.` }],
    };
  }

  const phase = findPhase(run.currentPhase);
  if (!phase) {
    return rejection(
      `Internal error: current phase "${run.currentPhase}" of run ${run.id} is not a known phase. Cannot validate or advance.`,
    );
  }

  // 1) needsUser: la marca NO prueba que el usuario decidió de verdad, solo exige que Claude declare
  //    explícitamente que trajo la decisión al usuario antes de cerrar la fase.
  if (phase.needsUser && evidence?.userConfirmed !== true) {
    return rejection(
      `Cannot close phase "${phase.id}": it needs a USER decision. Pass evidence.userConfirmed=true ` +
        `only after you actually brought the questions/options to the user and got their answer ` +
        `(this flag does not itself prove that happened — it only records that you claim it did).`,
    );
  }

  // 2) optional + skipped: si se declara skipped, exige una razón real; si no viene skipped, sigue el
  //    flujo normal de cierre (incluida su validación de completionSchema si la fase tiene una).
  const skipped = evidence?.skipped;
  if (phase.optional && skipped === true) {
    const reason = evidence.reason;
    if (typeof reason !== 'string' || reason.trim().length < 5) {
      return rejection(
        `Cannot skip optional phase "${phase.id}": evidence.reason must be a real explanation (min 5 chars) of why it does not apply.`,
      );
    }
  } else if (phase.completionSchema) {
    // 3) completionSchema: valida el contenido real del evidence contra el contrato de la fase.
    const result = phase.completionSchema.safeParse(evidence ?? {});
    if (!result.success) {
      const issues = result.error.issues
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ');
      return rejection(
        `Cannot close phase "${phase.id}": evidence does not satisfy its contract — ${issues}. ` +
          `Provide evidence matching what this phase actually produces.`,
      );
    }
  }

  // BUG A/B: closePhaseAndAdvance usa un optimistic lock (WHERE current_phase = ?) y señala un cierre
  // obsoleto lanzando StalePhaseError en vez de avanzar silenciosamente. Esto puede pasar tanto por
  // una carrera real (otro caller cerró esta fase primero) como por un caller con estado desactualizado
  // (pasó una fase que ya no es la actual) — ambos casos piden lo mismo: refrescar y reintentar.
  const next = nextPhaseId(run.currentPhase);
  try {
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
    store.closePhaseAndAdvance(run.id, run.currentPhase, summary, next, now());
  } catch (error) {
    if (error instanceof StalePhaseError) {
      return rejection(
        `Cannot close phase "${phase.id}" of run ${run.id}: another caller already advanced this run ` +
          `in the meantime, so your phase close is stale. Call forge_next (or forge_status) to see the ` +
          `real current state before retrying.`,
      );
    }
    throw error;
  }
  return {
    content: [
      {
        type: 'text',
        text: `Phase "${run.currentPhase}" closed. Now:\n\n${describePhase(next)}`,
      },
    ],
  };
}

export function buildServer(store: Store, now: () => number): McpServer {
  const server = new McpServer({ name: 'forge', version: '0.1.0' });

  // Arranca un run nuevo del pipeline y devuelve la primera fase.
  server.registerTool(
    'forge_start',
    {
      description:
        'Start a new forge pipeline run for a request. Returns the first phase (classify) and its goal. From here, follow the flow phase by phase using forge_next and forge_complete_phase — do not skip phases.',
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
              `— The forge pipeline guides you phase by phase. Do not write code or finish until every phase is closed with forge_complete_phase.`,
          },
        ],
      };
    },
  );

  // En qué fase está un run y su progreso.
  server.registerTool(
    'forge_status',
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
    'forge_next',
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
    'forge_complete_phase',
    {
      description:
        'Closes the CURRENT phase with a summary of what you did/decided, and advances to the next one. The summary is persisted (for resuming). Do not close a phase you have not actually done. Phases with a completionSchema (gates, qa, design, plan), phases needing user confirmation, and optional phases require structured `evidence` matching their contract — see the rejection message if it is missing or invalid.',
      inputSchema: {
        runId: z
          .string()
          .optional()
          .describe('Run id; optional when exactly one run is active.'),
        summary: z
          .string()
          .min(10, 'summary must not be empty/trivial')
          .describe(
            'What you did/decided in this phase (the artifact that closes it).',
          ),
        evidence: z
          .record(z.string(), z.unknown())
          .optional()
          .describe(
            'Structured evidence closing this phase (required shape depends on the phase): ' +
              'gates needs {lintExit,buildExit,testExit} all 0; qa needs {passed:true,failures,adversarial:{attacksTried,...}}; ' +
              'design needs {brainstormDone,designBriefDone,qaPlanDone,qualityGuideDone} all true; ' +
              'plan needs {leaves:[{leafId,block,owns},...]}; a phase needing user input needs {userConfirmed:true}; ' +
              'skipping an optional phase needs {skipped:true,reason}.',
          ),
      },
    },
    ({ runId, summary, evidence }) =>
      completePhaseHandler(store, now, { runId, summary, evidence }),
  );

  // Lista los runs activos (para reanudar desde cualquier sesión).
  server.registerTool(
    'forge_tasks',
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
            text: `Active runs (${String(runs.length)}):\n${lines.join('\n')}\n\nResume one with forge_next runId=<id>.`,
          },
        ],
      };
    },
  );

  // Lista las skills disponibles; con phase, las del SKILL_MAP de esa fase.
  server.registerTool(
    'forge_skills',
    {
      description:
        'Lists available skills. With a phase key (brainstorm/design/frontend/quality/qa/monetization/product), returns the skills that phase must load (from the SKILL_MAP). Without it, lists the whole arsenal.',
      inputSchema: {
        phase: z
          .string()
          .optional()
          .describe('Phase key to filter skills by (optional).'),
      },
    },
    ({ phase }) => {
      const skills = phase ? skillsForPhase(phase) : listSkills();
      const text = phase
        ? `Skills for phase "${phase}": ${skills.length ? skills.join(', ') : '(none)'}.\nLoad each with forge_skill.`
        : `Available skills (${String(skills.length)}):\n${skills.join(', ')}`;
      return { content: [{ type: 'text', text }] };
    },
  );

  // Devuelve el contenido del SKILL.md de una skill, para que Claude la cargue.
  server.registerTool(
    'forge_skill',
    {
      description:
        'Returns the SKILL.md content of a skill so you can load and apply it in the current phase.',
      inputSchema: {
        name: z.string().describe('Skill name (a folder in the arsenal).'),
      },
    },
    ({ name }) => {
      const content = readSkill(name);
      return {
        content: [
          {
            type: 'text',
            text:
              content ?? `No skill "${name}" found (or it has no SKILL.md).`,
          },
        ],
      };
    },
  );

  return server;
}

/**
 * Resuelve el run por id, o el único activo si no se da id.
 *
 * BUG E: con la DB pasando a ser GLOBAL (compartida entre proyectos), puede haber runs activos de
 * MÚLTIPLES proyectos/cwd simultáneamente — "el único activo" en toda la DB deja de ser una noción
 * útil de ambigüedad. Decisión: cuando hay más de un run activo mirando la DB entera, se desambigua
 * primero por `process.cwd()` (el proyecto desde el que efectivamente se está llamando este proceso
 * MCP) — si exactamente uno de los runs activos tiene ese mismo cwd, se resuelve a ese sin pedir
 * runId. Si hay más de uno con el MISMO cwd, sigue siendo responsabilidad del caller pasar runId
 * (ambiguo de verdad, ya no se puede resolver por proceso). Este filtro por cwd es un fallback: si ya
 * hay un único run activo en TODA la DB (caso típico de un solo proyecto usando forge), se resuelve
 * igual que antes sin siquiera mirar cwd.
 */
export function resolveRun(store: Store, runId?: string): Run | null {
  if (runId) return store.getRun(runId);
  const active = store.activeRuns();
  if (active.length === 1) return active[0];
  const activeHere = store.activeRunsForCwd(process.cwd());
  return activeHere.length === 1 ? activeHere[0] : null;
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
          : 'Could not infer the run (several or none active). Pass runId, or check forge_tasks.',
      },
    ],
  };
}

/** El path por default de la DB: única y global en `~/.forge/forge-mcp.db`, compartida entre todos
 *  los proyectos que usen este MCP (BUG E) — antes era relativa al cwd del proceso, lo que dejaba una
 *  DB distinta por proyecto/carpeta desde donde se lanzara el server. */
const DEFAULT_DB_PATH = join(homedir(), '.forge', 'forge-mcp.db');

/** Arranque: abre el store y sirve por stdio (como lo lanza el cliente MCP). */
async function main(): Promise<void> {
  const databasePath = process.env.FORGE_MCP_DB ?? DEFAULT_DB_PATH;
  // Asegura que el directorio de la DB exista (p. ej. ~/.forge/ en un homedir nuevo). Solo hace falta
  // para el default: si FORGE_MCP_DB es un override explícito, se asume que su directorio ya existe
  // o que el caller lo maneja — igual mkdirSync(dirname(...)) es inofensivo también en ese caso.
  mkdirSync(dirname(databasePath), { recursive: true });
  const store = new Store(databasePath);
  const server = buildServer(store, () => Date.now());
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Solo arranca el server stdio cuando este archivo es el ENTRYPOINT ejecutado directamente (node
// dist/server.js). Al ser importado (p. ej. desde server.test.ts para reusar completePhaseHandler),
// NO debe conectar un transporte stdio que se queda esperando stdin para siempre.
const isEntryPoint = import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `forge-mcp fatal: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  });
}
