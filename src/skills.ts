/**
 * La ENCICLOPEDIA de skills del MCP, autónoma (no depende del backend). Las 128 skills viven en la
 * carpeta `skills/` de ESTE proyecto (copiadas del arsenal del backend, versionadas). Cada skill es
 * una carpeta con un `SKILL.md` (su contenido) y a veces templates/scripts.
 *
 * El MCP las usa como el backend: el SKILL_MAP fija qué skills carga cada fase; cuando Claude ejecuta
 * una fase, pide las skills de esa fase (`forge_skills`) y su contenido (`forge_skill`) para cargarlas.
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Raíz de la carpeta de skills (relativa a este módulo compilado en dist/). */
const SKILLS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'skills',
);

/**
 * Skills obligatorias por fase (portado del SKILL_MAP del backend). La clave es un dominio del flujo;
 * las fases del pipeline las referencian. Es el control determinista de qué skill enriquece cada paso.
 */
export const SKILL_MAP: Record<string, string[]> = {
  brainstorm: ['brainstorming', 'continuous-discovery', 'jobs-to-be-done'],
  design: ['impeccable', 'design-an-interface', 'design-taste-frontend'],
  frontend: ['frontend-design', 'design-taste-frontend', 'tailwind-4'],
  quality: ['code-quality-master', 'clean-code', 'refactoring-ui'],
  qa: ['playwright-master', 'qa-master', 'browser-qa'],
  monetization: [
    'monetizing-innovation',
    'predictable-revenue',
    'hundred-million-offers',
  ],
  product: ['to-prd', 'storybrand-messaging', 'to-issues'],
};

/** Lista los nombres de todas las skills disponibles en el arsenal (carpetas con un SKILL.md). */
export function listSkills(): string[] {
  try {
    return readdirSync(SKILLS_DIR)
      .filter((name) => {
        const skillDirectory = join(SKILLS_DIR, name);
        return (
          statSync(skillDirectory).isDirectory() &&
          existsSync(join(skillDirectory, 'SKILL.md'))
        );
      })
      .sort();
  } catch {
    return [];
  }
}

/** Las skills que una fase (por su clave en SKILL_MAP) debe cargar. Vacío si la fase no mapea ninguna. */
export function skillsForPhase(phaseKey: string): string[] {
  return SKILL_MAP[phaseKey] ?? [];
}

/**
 * Contenido del `SKILL.md` de una skill, para que Claude la cargue. Devuelve null si la skill no existe
 * o no tiene SKILL.md (el llamador reporta el caso, no crashea).
 */
export function readSkill(name: string): string | null {
  // nombre saneado: solo el basename, sin rutas (evita salir de SKILLS_DIR con ../).
  const safeName = name.replace(/[/\\]/g, '');
  const skillFile = join(SKILLS_DIR, safeName, 'SKILL.md');
  try {
    if (!existsSync(skillFile)) return null;
    return readFileSync(skillFile, 'utf8');
  } catch {
    return null;
  }
}
