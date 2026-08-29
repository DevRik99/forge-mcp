/**
 * Las FASES del pipeline forge, en orden. Esta es la secuencia que el MCP FUERZA: Claude no puede
 * saltarse una fase ni terminar antes de cerrarlas todas (salvo las que no apliquen al pedido).
 *
 * Se derivan del flujo real del backend (NestJS en la VPS): clasificar el pedido, clarificar las
 * ambigüedades con el usuario, preparar el proyecto (setup+calidad), definir (brainstorm/diseño/qa/
 * calidad como documentos), planificar en tareas, construir, verificar con gates y QA, y entregar.
 *
 * A diferencia del backend, aquí NO hay workers: el EJECUTOR de cada fase es Claude. El MCP solo dice
 * qué fase toca, qué se espera de ella, y valida que se cierre antes de avanzar. El estado se persiste
 * (SQLite) para reanudar en cualquier sesión.
 */

/** Una fase del pipeline: qué es, qué se espera que Claude produzca, y si puede omitirse. */
export interface Phase {
  /** Id estable de la fase (clave en el estado). */
  id: string;
  /** Nombre legible. */
  title: string;
  /** Qué debe hacer Claude en esta fase (la instrucción que el MCP le devuelve). */
  goal: string;
  /** Qué artefacto/resultado cierra la fase (lo que Claude reporta al completarla). */
  produces: string;
  /** Si la fase involucra una decisión del USUARIO (Claude debe consultar, no decidir solo). */
  needsUser: boolean;
  /** Si la fase puede omitirse cuando no aplica al pedido (p. ej. deploy en un cambio interno). */
  optional: boolean;
}

/**
 * El pipeline completo, en orden. Un run avanza fase por fase; cada una se cierra con su artefacto
 * antes de pasar a la siguiente. `needsUser` marca dónde Claude trae la decisión al usuario.
 */
export const PHASES: Phase[] = [
  {
    id: 'classify',
    title: 'Classify the request',
    goal: 'Read the request and classify its nature (QUESTION / MICRO / STANDARD / HIGH-RISK) and scope. Identify what to build and the coarse risks.',
    produces: 'classification (level + scope + risks)',
    needsUser: false,
    optional: false,
  },
  {
    id: 'clarify',
    title: 'Clarify ambiguities',
    goal: 'Detect the ambiguities that change the product (shape, behavior, scope). Bring to the USER only the ones he must decide, with options and consequences. Resolve the rest with judgment, stating the assumption.',
    produces: 'product decisions (HIGH questions answered by the user)',
    needsUser: true,
    optional: false,
  },
  {
    id: 'setup',
    title: 'Prepare the project',
    goal: 'Decide the stack and its REAL versions (via tools: npm view / official CLIs, not from memory). Leave the project ready: scaffold + deps + strict linter configured, all via CLI. The project must build green.',
    produces: 'scaffolded project + decided stack + strict lint (green)',
    needsUser: false,
    optional: false,
  },
  {
    id: 'design',
    title: 'Define (design, QA-plan, quality)',
    goal: 'Before coding: brainstorm the solution, a design brief (UX/UI), a QA plan with edge cases, and a quality guide. Documents that guide the build; persisted as artifacts.',
    produces: 'design / QA-plan / quality documents',
    needsUser: false,
    optional: false,
  },
  {
    id: 'plan',
    title: 'Plan into tasks',
    goal: 'Decompose the work into atomic tasks with DISJOINT file ownership (so they do not overlap) and their minimum tests (success/error/edge) per task. The plan is the build contract.',
    produces: 'task plan (disjoint owns + tests per task)',
    needsUser: false,
    optional: false,
  },
  {
    id: 'build',
    title: 'Build',
    goal: 'Implement the plan tasks. You (Claude) build — with subagents if useful — reusing what exists, following the repo conventions, without overwriting other tasks. Cover the minimum tests of each task.',
    produces: 'feature code implemented',
    needsUser: false,
    optional: false,
  },
  {
    id: 'gates',
    title: 'Deterministic gates',
    goal: "Run the repo's real gates (strict lint + build + tests). Truth by exit code, not by self-report. If anything is red, fix until green before advancing.",
    produces: 'gates green (lint + build + tests)',
    needsUser: false,
    optional: false,
  },
  {
    id: 'qa',
    title: 'QA — it works and holds',
    goal: 'Verify for real: start the app, complete the flow end to end, then ATTACK it (break it: weird inputs, limits, XSS, impossible states). Not that the suite is green: that it DOES what was asked and holds the edges.',
    produces: 'QA verdict (works end-to-end + adversarial findings)',
    needsUser: false,
    optional: false,
  },
  {
    id: 'deliver',
    title: 'Deliver',
    goal: 'Publish the result per the request: remote repo, deploy, etc. Nothing is reported "online" without a real URL. Skip if the request needs no external delivery.',
    produces: 'delivery (repo/deploy with real URL, or skipped with reason)',
    needsUser: false,
    optional: true,
  },
];

/** Busca una fase por id. */
export function findPhase(id: string): Phase | undefined {
  return PHASES.find((phase) => phase.id === id);
}

/** El id de la primera fase (por donde arranca un run nuevo). */
export const FIRST_PHASE_ID = PHASES[0].id;
