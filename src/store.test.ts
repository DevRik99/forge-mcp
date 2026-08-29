/**
 * Tests UNITARIOS directos de store.ts (sin pasar por completePhaseHandler / transporte MCP): el
 * optimistic lock de `closePhaseAndAdvance` (BUG A/B) y la distinción última-fase vs fase-desconocida
 * de `nextPhaseId` (BUG C). Cada caso plantado se prueba junto a su corrección.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store, StalePhaseError, nextPhaseId } from './store.js';
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
    join(databaseDirectory, `store-test-${String(databaseCounter)}.db`),
  );
}

before(() => {
  databaseDirectory = mkdtempSync(join(tmpdir(), 'forge-mcp-store-test-'));
});

after(() => {
  // Windows: los sidecars WAL/SHM de sqlite pueden seguir bloqueados brevemente tras el último
  // acceso del proceso; limpieza best-effort, no parte del contrato bajo test.
  try {
    rmSync(databaseDirectory, { recursive: true, force: true });
  } catch {
    // best-effort cleanup; el OS limpia temp eventualmente.
  }
});

// --- BUG A: cierre concurrente del mismo run/fase -> el segundo debe fallar, no pisar/saltar ---
void test('closePhaseAndAdvance: a stale close (phase already advanced by another caller) throws StalePhaseError', () => {
  const store = freshStore();
  const run = store.createRun('run-race', 'req', '/tmp/project', now());
  // primer cierre: legítimo, avanza classify -> clarify.
  store.closePhaseAndAdvance(
    run.id,
    'classify',
    'first close wins',
    'clarify',
    now(),
  );
  const afterFirst = store.getRun(run.id);
  assert.equal(afterFirst?.currentPhase, 'clarify');

  // segundo "cierre" concurrente: sigue creyendo que la fase actual es 'classify' (estado stale) —
  // debe explotar, no debe pisar el avance del primero ni duplicar el artifact.
  assert.throws(() => {
    store.closePhaseAndAdvance(
      run.id,
      'classify',
      'second caller, stale view of the run',
      'clarify',
      now(),
    );
  }, StalePhaseError);
  const afterSecond = store.getRun(run.id);
  assert.equal(
    afterSecond?.currentPhase,
    'clarify',
    'the stale second close must not have moved the run further nor reverted it',
  );
});

// --- BUG A: el UPDATE exitoso, primero -> luego el INSERT del artifact; no queda huérfano ---
void test('closePhaseAndAdvance: a legit close persists both the artifact and the phase advance', () => {
  const store = freshStore();
  const run = store.createRun('run-ok', 'req', '/tmp/project', now());
  store.closePhaseAndAdvance(
    run.id,
    'classify',
    'closed classify for real',
    'clarify',
    now(),
  );
  const updated = store.getRun(run.id);
  assert.equal(updated?.currentPhase, 'clarify');
  const artifacts = store.artifactsOf(run.id);
  assert.equal(artifacts.length, 1);
  assert.equal(artifacts[0].phase, 'classify');
  assert.equal(artifacts[0].summary, 'closed classify for real');
});

// --- BUG A: tras un StalePhaseError no debe quedar un artifact huérfano de la fase que no cerró ---
void test('closePhaseAndAdvance: a stale close leaves no orphaned artifact behind', () => {
  const store = freshStore();
  const run = store.createRun('run-orphan', 'req', '/tmp/project', now());
  store.closePhaseAndAdvance(
    run.id,
    'classify',
    'first legit close',
    'clarify',
    now(),
  );
  assert.throws(() => {
    store.closePhaseAndAdvance(
      run.id,
      'classify',
      'stale retry',
      'clarify',
      now(),
    );
  });
  const artifacts = store.artifactsOf(run.id);
  assert.equal(
    artifacts.length,
    1,
    'only the one legit close should have persisted an artifact',
  );
  assert.equal(artifacts[0].summary, 'first legit close');
});

// --- BUG B: cerrar pasando una fase que NO es la currentPhase real (sin concurrencia real) falla igual ---
void test("closePhaseAndAdvance: closing a phase that is not the run's real currentPhase fails the same way", () => {
  const store = freshStore();
  const run = store.createRun('run-wrong-phase', 'req', '/tmp/project', now());
  // el run está en 'classify'; intentamos cerrar 'clarify' (una fase que todavía no es la actual).
  assert.throws(() => {
    store.closePhaseAndAdvance(
      run.id,
      'clarify',
      'trying to close a phase that is not current',
      'setup',
      now(),
    );
  }, StalePhaseError);
  const stillHere = store.getRun(run.id);
  assert.equal(
    stillHere?.currentPhase,
    'classify',
    'run must remain at its real current phase',
  );
});

// --- BUG C: fase desconocida -> throw con el id en el mensaje (no null silencioso) ---
void test('nextPhaseId: an unknown phase id throws, naming the invalid id', () => {
  assert.throws(
    () => nextPhaseId('no-existe-esta-fase'),
    (error: unknown) =>
      error instanceof Error && error.message.includes('no-existe-esta-fase'),
  );
});

// --- BUG C: la última fase real del pipeline sigue devolviendo null (no explota) ---
void test('nextPhaseId: the real last phase of the pipeline returns null, not a throw', () => {
  const lastPhaseId = PHASES[PHASES.length - 1].id;
  assert.equal(nextPhaseId(lastPhaseId), null);
});

// --- BUG C: una fase intermedia real sigue devolviendo el id de la siguiente ---
void test('nextPhaseId: a real intermediate phase returns the next phase id', () => {
  assert.equal(nextPhaseId('classify'), 'clarify');
});
