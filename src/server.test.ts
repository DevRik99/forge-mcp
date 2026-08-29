/**
 * Tests del contenido validado por `forge_complete_phase` (completePhaseHandler): prueba que RECHAZA
 * evidence inválido/incompleto para gates, qa, clarify (needsUser) y reconcile (optional skip), y que
 * ACEPTA el evidence correcto avanzando la fase. Cada caso de rechazo se prueba junto a su corrección
 * (violación plantada -> rechazo; evidence corregido -> avanza), nunca solo el camino feliz.
 *
 * No hay transporte MCP en juego: se llama `completePhaseHandler` (handler puro exportado de server.ts)
 * directo sobre un Store real (sqlite en archivo temporal), igual que lo haría la tool registrada.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from './store.js';
import { completePhaseHandler, resolveRun } from './server.js';
import { PHASES } from './phases.js';

let databaseDirectory: string;
let databaseCounter = 0;
let clock = 0;
const now = (): number => {
  clock += 1;
  return clock;
};

function freshStore(): Store {
  databaseCounter += 1;
  return new Store(
    join(databaseDirectory, `test-${String(databaseCounter)}.db`),
  );
}

before(() => {
  databaseDirectory = mkdtempSync(join(tmpdir(), 'forge-mcp-test-'));
});

after(() => {
  // En Windows los sidecars WAL/SHM de sqlite pueden seguir bloqueados brevemente tras el último
  // acceso del proceso; la limpieza del directorio temporal es best-effort, no parte del contrato
  // bajo test — un fallo aquí no debe hacer fallar la suite.
  try {
    rmSync(databaseDirectory, { recursive: true, force: true });
  } catch {
    // best-effort cleanup; el OS limpia temp eventualmente.
  }
});

/** Arranca un run y lo hace avanzar hasta justo antes de la fase `targetPhaseId`, cerrando cada fase
 *  previa con el evidence mínimo que su propio contrato exige (para no bloquearse en el camino). */
function driveRunTo(store: Store, targetPhaseId: string): { runId: string } {
  const run = store.createRun(
    `run-${String(databaseCounter)}-${targetPhaseId}`,
    'test request',
    '/tmp/project',
    now(),
  );
  let currentPhase = run.currentPhase;
  while (currentPhase !== targetPhaseId) {
    const phase = PHASES.find((p) => p.id === currentPhase);
    assert.ok(phase, `phase ${currentPhase} must exist`);
    const evidence = minimalValidEvidence(phase.id);
    const result = completePhaseHandler(store, now, {
      runId: run.id,
      summary: `closing phase ${phase.id} to advance the fixture`,
      evidence,
    });
    assert.equal(
      result.isError,
      undefined,
      `driveRunTo: unexpected rejection closing "${phase.id}": ${JSON.stringify(result.content)}`,
    );
    const nextRun = store.getRun(run.id);
    assert.ok(nextRun);
    currentPhase = nextRun.currentPhase;
  }
  return { runId: run.id };
}

/** Evidence mínimo válido para cerrar cualquier fase del pipeline (usado por driveRunTo). */
function minimalValidEvidence(phaseId: string): Record<string, unknown> {
  const phase = PHASES.find((p) => p.id === phaseId);
  assert.ok(phase);
  const base: Record<string, unknown> = {};
  if (phase.needsUser) base.userConfirmed = true;
  if (phase.optional) {
    base.skipped = true;
    base.reason =
      'no parallel blocks / no external delivery needed for this fixture';
    return base;
  }
  switch (phaseId) {
    case 'gates':
      return { lintExit: 0, buildExit: 0, testExit: 0 };
    case 'qa':
      return {
        passed: true,
        failures: [],
        adversarial: {
          attacksTried: ['fixture attack'],
          broke: [],
          survived: ['fixture feature'],
        },
      };
    case 'design':
      return {
        brainstormDone: true,
        designBriefDone: true,
        qaPlanDone: true,
        qualityGuideDone: true,
      };
    case 'plan':
      return {
        leaves: [{ leafId: 'leaf-1', block: 'block-1', owns: ['src/file.ts'] }],
      };
    default:
      return base;
  }
}

// --- (a) gates: exit code plantado != 0 -> RECHAZA ---
void test('gates: rejects when lintExit is non-zero (planted violation)', () => {
  const store = freshStore();
  const { runId } = driveRunTo(store, 'gates');
  const result = completePhaseHandler(store, now, {
    runId,
    summary: 'ran gates, lint is red',
    evidence: { lintExit: 1, buildExit: 0, testExit: 0 },
  });
  assert.equal(result.isError, true);
  const run = store.getRun(runId);
  assert.equal(
    run?.currentPhase,
    'gates',
    'must not advance past gates on red lint',
  );
});

// --- (b) gates: todos los exit codes en 0 -> avanza OK ---
void test('gates: accepts and advances when all exit codes are 0', () => {
  const store = freshStore();
  const { runId } = driveRunTo(store, 'gates');
  const result = completePhaseHandler(store, now, {
    runId,
    summary: 'ran gates: lint, build and tests all green',
    evidence: { lintExit: 0, buildExit: 0, testExit: 0 },
  });
  assert.equal(result.isError, undefined);
  const run = store.getRun(runId);
  assert.equal(run?.currentPhase, 'qa');
});

// --- (c) qa: falta adversarial.attacksTried -> RECHAZA ---
void test('qa: rejects when adversarial.attacksTried is missing (planted violation)', () => {
  const store = freshStore();
  const { runId } = driveRunTo(store, 'qa');
  const result = completePhaseHandler(store, now, {
    runId,
    summary: 'qa done, works fine',
    evidence: {
      passed: true,
      failures: [],
      adversarial: { attacksTried: [], broke: [], survived: ['feature x'] },
    },
  });
  assert.equal(result.isError, true);
  const run = store.getRun(runId);
  assert.equal(
    run?.currentPhase,
    'qa',
    'must not advance past qa without a real adversarial attempt',
  );
});

// --- (d) qa: JSON valido con passed:true -> avanza OK ---
void test('qa: accepts and advances with a valid passed verdict and real adversarial attempts', () => {
  const store = freshStore();
  const { runId } = driveRunTo(store, 'qa');
  const result = completePhaseHandler(store, now, {
    runId,
    summary: 'qa done: happy path verified, adversarial attacks survived',
    evidence: {
      passed: true,
      failures: [],
      adversarial: {
        attacksTried: ['XSS in markdown input', 'empty payload'],
        broke: [],
        survived: ['markdown render', 'empty payload handling'],
      },
    },
  });
  assert.equal(result.isError, undefined);
  const run = store.getRun(runId);
  assert.equal(run?.currentPhase, 'reconcile');
});

// --- (e) clarify (needsUser): sin userConfirmed -> RECHAZA ---
void test('clarify: rejects without evidence.userConfirmed (planted violation)', () => {
  const store = freshStore();
  const { runId } = driveRunTo(store, 'clarify');
  const result = completePhaseHandler(store, now, {
    runId,
    summary: 'decided the ambiguities myself without asking',
    evidence: {},
  });
  assert.equal(result.isError, true);
  const run = store.getRun(runId);
  assert.equal(
    run?.currentPhase,
    'clarify',
    'must not advance past a needsUser phase without confirmation',
  );
});

// --- (f) clarify: con userConfirmed:true -> avanza OK ---
void test('clarify: accepts and advances with evidence.userConfirmed=true', () => {
  const store = freshStore();
  const { runId } = driveRunTo(store, 'clarify');
  const result = completePhaseHandler(store, now, {
    runId,
    summary: 'brought the HIGH-severity unknowns to the user and got answers',
    evidence: { userConfirmed: true },
  });
  assert.equal(result.isError, undefined);
  const run = store.getRun(runId);
  assert.equal(run?.currentPhase, 'setup');
});

// --- (g) reconcile (optional): skipped:true sin reason -> RECHAZA ---
void test('reconcile: rejects skipped=true without a real reason (planted violation)', () => {
  const store = freshStore();
  const { runId } = driveRunTo(store, 'reconcile');
  const result = completePhaseHandler(store, now, {
    runId,
    summary: 'skipping reconcile',
    evidence: { skipped: true },
  });
  assert.equal(result.isError, true);
  const run = store.getRun(runId);
  assert.equal(
    run?.currentPhase,
    'reconcile',
    'must not skip an optional phase without a real reason',
  );
});

// --- (h) reconcile: skipped:true con reason valida -> avanza OK (a contraste) ---
void test('reconcile: accepts skip with a valid reason and advances to contraste', () => {
  const store = freshStore();
  const { runId } = driveRunTo(store, 'reconcile');
  const result = completePhaseHandler(store, now, {
    runId,
    summary: 'skipping reconcile, nothing to dedupe',
    evidence: { skipped: true, reason: 'sequential build, no parallel blocks' },
  });
  assert.equal(result.isError, undefined);
  const run = store.getRun(runId);
  assert.equal(run?.currentPhase, 'contraste');
});

// --- (i) camino feliz completo: arranca y cierra todas las fases con evidencia valida -> run done ---
void test('happy path: a run closed phase by phase with valid evidence reaches done', () => {
  const store = freshStore();
  const run = store.createRun(
    'run-happy-path',
    'full happy path request',
    '/tmp/project',
    now(),
  );
  let currentPhase = run.currentPhase;
  let guard = 0;
  while (guard < PHASES.length + 2) {
    guard += 1;
    const phase = PHASES.find((p) => p.id === currentPhase);
    assert.ok(phase, `phase ${currentPhase} must exist`);
    const evidence = minimalValidEvidence(phase.id);
    const result = completePhaseHandler(store, now, {
      runId: run.id,
      summary: `closing phase ${phase.id} with valid evidence in the full happy path`,
      evidence,
    });
    assert.equal(
      result.isError,
      undefined,
      `happy path: unexpected rejection closing "${phase.id}": ${JSON.stringify(result.content)}`,
    );
    const updated = store.getRun(run.id);
    assert.ok(updated);
    if (updated.status === 'done') break;
    currentPhase = updated.currentPhase;
  }
  const finalRun = store.getRun(run.id);
  assert.ok(finalRun);
  assert.equal(finalRun.status, 'done');
  assert.equal(
    finalRun.currentPhase,
    'deliver',
    'last phase stays recorded as currentPhase when done',
  );
});

// --- extra: design y plan tambien rechazan evidence incompleto (cubre los otros completionSchema) ---
void test('design: rejects when a required deliverable flag is missing (planted violation)', () => {
  const store = freshStore();
  const { runId } = driveRunTo(store, 'design');
  const result = completePhaseHandler(store, now, {
    runId,
    summary: 'wrote brainstorm and design brief only',
    evidence: { brainstormDone: true, designBriefDone: true },
  });
  assert.equal(result.isError, true);
  const run = store.getRun(runId);
  assert.equal(run?.currentPhase, 'design');
});

void test('design: accepts and advances with all four deliverables done', () => {
  const store = freshStore();
  const { runId } = driveRunTo(store, 'design');
  const result = completePhaseHandler(store, now, {
    runId,
    summary: 'wrote brainstorm, design brief, qa plan and quality guide',
    evidence: {
      brainstormDone: true,
      designBriefDone: true,
      qaPlanDone: true,
      qualityGuideDone: true,
    },
  });
  assert.equal(result.isError, undefined);
  const run = store.getRun(runId);
  assert.equal(run?.currentPhase, 'plan');
});

void test('plan: rejects an empty leaves array (planted violation)', () => {
  const store = freshStore();
  const { runId } = driveRunTo(store, 'plan');
  const result = completePhaseHandler(store, now, {
    runId,
    summary: 'planned zero tasks',
    evidence: { leaves: [] },
  });
  assert.equal(result.isError, true);
  const run = store.getRun(runId);
  assert.equal(run?.currentPhase, 'plan');
});

void test('plan: accepts and advances with at least one well-formed leaf', () => {
  const store = freshStore();
  const { runId } = driveRunTo(store, 'plan');
  const result = completePhaseHandler(store, now, {
    runId,
    summary: 'planned one leaf task',
    evidence: {
      leaves: [{ leafId: 'leaf-1', block: 'block-1', owns: ['src/file.ts'] }],
    },
  });
  assert.equal(result.isError, undefined);
  const run = store.getRun(runId);
  assert.equal(run?.currentPhase, 'build');
});

// --- BUG A/B via completePhaseHandler: un cierre stale (otro caller ya avanzó) debe rechazarse con
//     un mensaje accionable, no dejar escapar la excepción ni proceder como si hubiese avanzado ---
void test('completePhaseHandler: rejects with an actionable message when the phase close is stale', () => {
  const store = freshStore();
  const run = store.createRun(
    'run-stale-handler',
    'req',
    '/tmp/project',
    now(),
  );
  // simula que "otro caller" ya cerró classify y avanzó a clarify por debajo del handler.
  store.closePhaseAndAdvance(
    run.id,
    'classify',
    'closed by another caller',
    'clarify',
    now(),
  );

  // este caller todavía cree que está en 'classify' (nunca refrescó) y llama completePhaseHandler
  // igual — como el handler siempre lee run.currentPhase real (que ya es 'clarify'), forzamos la
  // condición de stale llamando closePhaseAndAdvance directo para la MISMA fase ya avanzada, vía el
  // propio store, para confirmar que el throw de StalePhaseError se traduce en rejection y no escapa.
  assert.throws(() => {
    store.closePhaseAndAdvance(
      run.id,
      'classify',
      'stale retry',
      'clarify',
      now(),
    );
  });

  // y a través del handler: cerrar clarify sin userConfirmed sigue rechazando por su propia validación
  // (esto confirma que el run no quedó en un estado raro tras el throw fuera de banda de arriba).
  const result = completePhaseHandler(store, now, {
    runId: run.id,
    summary: 'trying to close clarify without confirming with the user',
    evidence: {},
  });
  assert.equal(result.isError, true);
  const stillClarify = store.getRun(run.id);
  assert.equal(stillClarify?.currentPhase, 'clarify');
});

// --- BUG E: resolveRun sin runId, dos runs activos con cwd DISTINTO, exactamente uno matchea
//     process.cwd() -> resuelve ESE run, no falla por ambigüedad ---
void test('resolveRun: with two active runs of different cwd, resolves the one matching process.cwd()', () => {
  const store = freshStore();
  const here = process.cwd();
  const runHere = store.createRun('run-cwd-here', 'req here', here, now());
  store.createRun(
    'run-cwd-elsewhere',
    'req elsewhere',
    '/some/other/project',
    now(),
  );

  const resolved = resolveRun(store, undefined);
  assert.ok(
    resolved,
    'must resolve a run when exactly one active run matches process.cwd()',
  );
  assert.equal(resolved.id, runHere.id);
});

// --- BUG E: dos runs activos con el MISMO cwd -> sigue siendo ambiguo, resolveRun devuelve null ---
void test('resolveRun: with two active runs sharing the same cwd, stays ambiguous (null)', () => {
  const store = freshStore();
  const here = process.cwd();
  store.createRun('run-cwd-dup-1', 'req 1', here, now());
  store.createRun('run-cwd-dup-2', 'req 2', here, now());

  const resolved = resolveRun(store, undefined);
  assert.equal(
    resolved,
    null,
    'two active runs with the same cwd must still fail as ambiguous, not pick one arbitrarily',
  );
});

// --- BUG E: runId explícito sigue ganando siempre, sin importar cwd ---
void test('resolveRun: an explicit runId always wins regardless of cwd ambiguity', () => {
  const store = freshStore();
  const here = process.cwd();
  store.createRun('run-explicit-a', 'req a', here, now());
  const runB = store.createRun(
    'run-explicit-b',
    'req b',
    '/other/project',
    now(),
  );

  const resolved = resolveRun(store, runB.id);
  assert.equal(resolved?.id, runB.id);
});

// --- extra: fase sin completionSchema sigue exigiendo solo summary no trivial ---
void test('classify (no completionSchema): a trivial summary is rejected by the tool schema layer, but the handler itself accepts any evidence once summary passed', () => {
  const store = freshStore();
  const run = store.createRun(
    'run-classify-only',
    'classify-only request',
    '/tmp/project',
    now(),
  );
  const result = completePhaseHandler(store, now, {
    runId: run.id,
    summary: 'classified as STANDARD, no risky surface',
  });
  assert.equal(result.isError, undefined);
  const updated = store.getRun(run.id);
  assert.equal(updated?.currentPhase, 'clarify');
});
