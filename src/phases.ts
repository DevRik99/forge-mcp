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
    title: 'Clasificar el pedido',
    goal: 'Lee el pedido y clasifica su naturaleza (QUESTION / MICRO / STANDARD / HIGH-RISK) y su alcance. Identifica qué construir y los riesgos gruesos.',
    produces: 'clasificación (nivel + alcance + riesgos)',
    needsUser: false,
    optional: false,
  },
  {
    id: 'clarify',
    title: 'Clarificar ambigüedades',
    goal: 'Detecta las ambigüedades que cambian el producto (forma, comportamiento, alcance). Trae al USUARIO solo las que él debe decidir, con opciones y consecuencias. Resuelve el resto con criterio, declarando el supuesto.',
    produces: 'decisiones de producto (preguntas HIGH respondidas por el usuario)',
    needsUser: true,
    optional: false,
  },
  {
    id: 'setup',
    title: 'Preparar el proyecto',
    goal: 'Decide el stack y sus versiones REALES (por herramientas: npm view / CLIs oficiales, no de memoria). Deja el proyecto listo: scaffold + deps + linter estricto configurado, todo por CLI. El proyecto debe compilar en verde.',
    produces: 'proyecto scaffoldeado + stack decidido + lint estricto (verde)',
    needsUser: false,
    optional: false,
  },
  {
    id: 'design',
    title: 'Definir (diseño, QA-plan, calidad)',
    goal: 'Antes de codear: brainstorm de la solución, brief de diseño (UX/UI), plan de QA con casos borde, y guía de calidad. Documentos que guían la construcción; se persisten como artefactos.',
    produces: 'documentos de diseño / QA-plan / calidad',
    needsUser: false,
    optional: false,
  },
  {
    id: 'plan',
    title: 'Planificar en tareas',
    goal: 'Descompón el trabajo en tareas atómicas con ownership de archivos DISJUNTO (que no se pisen) y sus tests mínimos (éxito/error/borde) por tarea. El plan es el contrato de la construcción.',
    produces: 'plan de tareas (con owns disjunto + tests por tarea)',
    needsUser: false,
    optional: false,
  },
  {
    id: 'build',
    title: 'Construir',
    goal: 'Implementa las tareas del plan. Tú (Claude) construyes —con subagentes si conviene—, reutilizando lo que existe, siguiendo las convenciones del repo, sin pisar el trabajo de otras tareas. Cubre los tests mínimos de cada tarea.',
    produces: 'código de las features implementado',
    needsUser: false,
    optional: false,
  },
  {
    id: 'gates',
    title: 'Gates deterministas',
    goal: 'Corre los gates reales del repo (lint estricto + build + tests). Verdad por exit code, no por autoreporte. Si algo está rojo, corrige hasta verde antes de avanzar.',
    produces: 'gates en verde (lint + build + tests)',
    needsUser: false,
    optional: false,
  },
  {
    id: 'qa',
    title: 'QA — funciona y aguanta',
    goal: 'Verifica de verdad: arranca la app, completa el flujo de punta a punta, y luego ATÁCALA (romperla: inputs raros, límites, XSS, estados imposibles). No que la suite esté verde: que HAGA lo pedido y aguante los bordes.',
    produces: 'veredicto QA (funciona end-to-end + hallazgos adversariales)',
    needsUser: false,
    optional: false,
  },
  {
    id: 'deliver',
    title: 'Entregar',
    goal: 'Publica el resultado según el pedido: repo remoto, deploy, etc. Nada se reporta "online" sin una URL real. Omitir si el pedido no pide entrega externa.',
    produces: 'entrega (repo/deploy con URL real, o omitida con motivo)',
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
