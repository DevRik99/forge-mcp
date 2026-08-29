/**
 * STORE del estado del pipeline, en SQLite nativo de Node (node:sqlite, sin compilación). Persiste lo
 * necesario para REANUDAR un run en cualquier sesión: qué runs hay, en qué fase está cada uno, y el
 * artefacto con que se cerró cada fase (la decisión de clarify, el plan, el veredicto de QA...).
 *
 * Por qué persistir aunque el ejecutor (Claude) ya "recuerde": el contexto de Claude NO sobrevive a un
 * cierre de sesión, una compactación, ni a retomar mañana. El estado del flujo sí debe: así `forge_tareas`
 * lista los runs a medias y `forge_reanudar` retoma desde la fase exacta con las decisiones ya tomadas.
 *
 * NO se guarda el dispatch de workers ni el estado de procesos (eso es del backend pesado): aquí el
 * ejecutor es Claude, que no se cae como un worker. Solo el estado del FLUJO.
 */
import { DatabaseSync } from 'node:sqlite';
import { PHASES, FIRST_PHASE_ID } from './phases.js';

/** Un run del pipeline: su pedido, dónde vive el proyecto, la fase actual y si terminó. */
export interface Run {
  id: string;
  request: string;
  cwd: string;
  currentPhase: string;
  status: 'active' | 'done' | 'abandoned';
  createdAt: number;
  updatedAt: number;
}

/** El artefacto con que Claude cerró una fase (el resultado que la da por hecha). */
export interface PhaseArtifact {
  runId: string;
  phase: string;
  summary: string;
  closedAt: number;
}

/**
 * Señal explícita de que `closePhaseAndAdvance` no pudo cerrar la fase: el `current_phase` real en la
 * DB ya no coincidía con `phase` cuando se intentó el UPDATE (otro cierre concurrente ganó la carrera,
 * o el caller tenía un estado obsoleto). El caller debe refrescar el run y no asumir que avanzó.
 */
export class StalePhaseError extends Error {
  constructor(
    public readonly runId: string,
    public readonly phase: string,
  ) {
    super(
      `closePhaseAndAdvance: run ${runId} is no longer at phase "${phase}" (concurrent close or stale caller).`,
    );
    this.name = 'StalePhaseError';
  }
}

export class Store {
  private readonly _db: DatabaseSync;

  constructor(databasePath: string) {
    this._db = new DatabaseSync(databasePath);
    this._db.exec('PRAGMA journal_mode = WAL');
    this._migrate();
  }

  private _migrate(): void {
    this._db.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        request TEXT NOT NULL,
        cwd TEXT NOT NULL,
        current_phase TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS phase_artifacts (
        run_id TEXT NOT NULL,
        phase TEXT NOT NULL,
        summary TEXT NOT NULL,
        closed_at INTEGER NOT NULL,
        PRIMARY KEY (run_id, phase)
      );
    `);
  }

  /** Crea un run nuevo en la primera fase. `now` inyectable para no atarse al reloj. */
  createRun(id: string, request: string, cwd: string, now: number): Run {
    this._db
      .prepare(
        `INSERT INTO runs (id, request, cwd, current_phase, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'active', ?, ?)`,
      )
      .run(id, request, cwd, FIRST_PHASE_ID, now, now);
    // recién insertado con estos valores: se arma el Run directo (evita un SELECT + el non-null assertion).
    return {
      id,
      request,
      cwd,
      currentPhase: FIRST_PHASE_ID,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
  }

  getRun(id: string): Run | null {
    const row = this._db.prepare('SELECT * FROM runs WHERE id = ?').get(id) as
      Record<string, unknown> | undefined;
    return row ? this._rowToRun(row) : null;
  }

  /** Runs activos (para `forge_tareas`: qué hay a medias para reanudar). Más recientes primero. */
  activeRuns(): Run[] {
    const rows = this._db
      .prepare(
        "SELECT * FROM runs WHERE status = 'active' ORDER BY updated_at DESC",
      )
      .all() as Record<string, unknown>[];
    return rows.map((row) => this._rowToRun(row));
  }

  /**
   * Cierra la fase actual con su artefacto y avanza el run a la fase `nextPhase`.
   *
   * Optimistic lock (BUG A/B): el UPDATE solo afecta la fila si `current_phase` en la DB sigue
   * siendo exactamente `phase` (el WHERE lleva `AND current_phase = ?`). Esto cubre ATÓMICAMENTE
   * dos casos con la misma condición: (A) una carrera real entre dos cierres concurrentes del mismo
   * run (el segundo en llegar encuentra `current_phase` ya cambiado por el primero), y (B) un caller
   * que pasa un `phase` que no es la fase actual real del run (p. ej. una fase vieja tras un avance
   * que no vio). En ambos casos `changes` da 0 y no hay forma de distinguirlos desde aquí — no hace
   * falta: el caller solo necesita saber "tu cierre quedó obsoleto, refresca el estado".
   *
   * Orden: el UPDATE condicional se intenta PRIMERO. Solo si tuvo éxito (`changes === 1`) se hace el
   * INSERT del artifact — así nunca queda un artifact huérfano de una fase que en realidad no se
   * pudo cerrar (evita el data-loss / inconsistencia del orden anterior: INSERT primero, UPDATE
   * después, donde un UPDATE fallido dejaba el artifact persistido igual).
   *
   * Señal de fallo: throw de `StalePhaseError` (en vez de un valor de retorno discriminado) para que
   * el caller no pueda ignorar el caso por accidente (un `if` olvidado en un valor de retorno pasaría
   * desapercibido; un throw no capturado explota ruidosamente). El caller (`completePhaseHandler`)
   * lo captura y traduce a un rejection accionable.
   */
  closePhaseAndAdvance(
    runId: string,
    phase: string,
    summary: string,
    nextPhase: string,
    now: number,
  ): void {
    const updateResult = this._db
      .prepare(
        'UPDATE runs SET current_phase = ?, updated_at = ? WHERE id = ? AND current_phase = ?',
      )
      .run(nextPhase, now, runId, phase);
    if (Number(updateResult.changes) !== 1) {
      throw new StalePhaseError(runId, phase);
    }
    this._db
      .prepare(
        `INSERT OR REPLACE INTO phase_artifacts (run_id, phase, summary, closed_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(runId, phase, summary, now);
  }

  /**
   * Runs activos cuyo `cwd` coincide con `cwd` (BUG E: con una DB GLOBAL compartida entre proyectos,
   * puede haber runs activos de MÚLTIPLES proyectos a la vez; esto permite desambiguar "el único
   * activo" filtrando primero por el proyecto/cwd desde el que se llama). Más recientes primero.
   */
  activeRunsForCwd(cwd: string): Run[] {
    const rows = this._db
      .prepare(
        "SELECT * FROM runs WHERE status = 'active' AND cwd = ? ORDER BY updated_at DESC",
      )
      .all(cwd) as Record<string, unknown>[];
    return rows.map((row) => this._rowToRun(row));
  }

  /** Marca el run como terminado (todas las fases cerradas). */
  finishRun(runId: string, now: number): void {
    this._db
      .prepare("UPDATE runs SET status = 'done', updated_at = ? WHERE id = ?")
      .run(now, runId);
  }

  /** Artefactos cerrados de un run (el historial de decisiones, para reanudar con contexto). */
  artifactsOf(runId: string): PhaseArtifact[] {
    const rows = this._db
      .prepare(
        'SELECT * FROM phase_artifacts WHERE run_id = ? ORDER BY closed_at',
      )
      .all(runId) as Record<string, unknown>[];
    return rows.map((row) => ({
      runId: String(row.run_id),
      phase: String(row.phase),
      summary: String(row.summary),
      closedAt: Number(row.closed_at),
    }));
  }

  private _rowToRun(row: Record<string, unknown>): Run {
    return {
      id: String(row.id),
      request: String(row.request),
      cwd: String(row.cwd),
      currentPhase: String(row.current_phase),
      status: row.status as Run['status'],
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    };
  }
}

/**
 * El id de la fase que sigue a `phase`, o null si `phase` es genuinamente la última del pipeline.
 *
 * BUG C: antes esta función devolvía `null` tanto para "es la última fase" (legítimo) como para "el
 * id no existe en PHASES" (corrupción de datos — un current_phase inválido en la DB), lo cual es
 * ambiguo para cualquier caller que no sea `completePhaseHandler` (que hoy evita este caso con un
 * guard previo, pero esta función debe ser correcta por sí misma, sin depender de ese guard). Ahora
 * un id desconocido explota con un mensaje que lo nombra; `null` queda reservado solo para el caso
 * legítimo de última fase.
 */
export function nextPhaseId(phase: string): string | null {
  const index = PHASES.findIndex((p) => p.id === phase);
  if (index < 0) {
    throw new Error(`nextPhaseId: unknown phase "${phase}"`);
  }
  if (index >= PHASES.length - 1) return null;
  return PHASES[index + 1].id;
}
