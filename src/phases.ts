/**
 * Las FASES del pipeline forge, en orden. Esta es la secuencia que el MCP FUERZA: Claude no puede
 * saltarse una fase ni terminar antes de cerrarlas todas (salvo las que no apliquen al pedido).
 *
 * El flujo cubre: clasificar el pedido, clarificar las ambigüedades con el usuario, preparar el
 * proyecto (setup+calidad), definir (brainstorm/diseño/qa/calidad como documentos), planificar en
 * tareas, construir, verificar con gates y QA, y entregar.
 *
 * Este MCP es el DIRECTOR: le dice a Claude qué fase toca y qué evidencia debe producir para
 * cerrarla. El EJECUTOR de cada fase es Claude — directamente, o con subagentes si le sirve. No hay
 * despacho a workers externos ni reintentos de proceso: el estado que se persiste (SQLite) es solo el
 * del FLUJO, para reanudar en cualquier sesión.
 *
 * `systemPrompt` es el prompt REAL y completo de cada fase, para que Claude la ejecute con el mismo
 * criterio en cualquier sesión. `skills` son las skills de Claude Code que esa fase debe cargar.
 *
 * `completionSchema` valida el CONTENIDO real del `evidence` con que se cierra la fase (no solo que
 * `summary` sea un string no vacío): fuerza que gates reporte exit codes en 0, que QA reporte
 * `passed:true` con intentos adversariales reales, etc. Las fases sin `completionSchema` siguen
 * exigiendo solo `summary` no trivial (ver server.ts). `needsUser` y `optional` se validan de forma
 * GENÉRICA en server.ts (no como completionSchema) porque aplican transversalmente a cualquier fase.
 */
import { z, type ZodType } from 'zod';

/** Una fase del pipeline: qué es, qué se espera que Claude produzca, y si puede omitirse. */
export interface Phase {
  /** Id estable de la fase (clave en el estado). */
  id: string;
  /** Nombre legible. */
  title: string;
  /** Qué debe hacer Claude en esta fase (la instrucción que el MCP le devuelve). */
  goal: string;
  /** Prompt real y completo de la fase (fuente de verdad del criterio que Claude debe cumplir). */
  systemPrompt: string;
  /** Skills de Claude Code que esta fase debe cargar (vacío si ninguna aplica). */
  skills: string[];
  /** Qué artefacto/resultado cierra la fase (lo que Claude reporta al completarla). */
  produces: string;
  /** Si la fase involucra una decisión del USUARIO (Claude debe consultar, no decidir solo). */
  needsUser: boolean;
  /** Si la fase puede omitirse cuando no aplica al pedido (p. ej. deploy en un cambio interno). */
  optional: boolean;
  /**
   * Schema opcional que valida el CONTENIDO del `evidence` estructurado con que se cierra la fase.
   * Si está presente, `forge_complete_phase` RECHAZA el cierre cuando `evidence` no lo satisface.
   * Ausente = solo se exige `summary` no trivial (comportamiento por defecto).
   */
  completionSchema?: ZodType;
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
    systemPrompt:
      'Classify the NATURE of this coding request so the pipeline applies the right rigor. QUESTION = read-only, no changes. MICRO = a small, known, reversible local change. STANDARD = a normal feature. HIGH-RISK = touches money, auth, PII, persistent/production data, public API, architecture, or anything irreversible. Judge by what the request actually implies. Return JSON: {"level":"QUESTION|MICRO|STANDARD|HIGH-RISK","reason":"why","risks":["..."]}.',
    skills: [],
    produces: 'classification (level + scope + risks)',
    needsUser: false,
    optional: false,
  },
  {
    id: 'clarify',
    title: 'Clarify ambiguities',
    goal: 'Detect the ambiguities that change the product (shape, behavior, scope). Bring to the USER only the ones he must decide, with options and consequences. Resolve the rest with judgment, stating the assumption.',
    systemPrompt:
      'Find the ambiguities in this request that would MATERIALLY change the product, architecture, data, or external effects if guessed wrong — the things a good engineer must NOT assume. For each, give the question and the options with their consequence. Ignore trivial ambiguities that any reasonable default resolves. Return JSON: {"unknowns":[{"question":"...","options":[{"id":"...","label":"...","consequence":"..."}],"severity":"HIGH|LOW"}]}. Empty unknowns if the request is clear.',
    skills: [],
    produces: 'product decisions (HIGH questions answered by the user)',
    needsUser: true,
    optional: false,
  },
  {
    id: 'setup',
    title: 'Prepare the project',
    goal: 'Decide the stack and its REAL versions (via tools: npm view / official CLIs, not from memory). Leave the project ready: scaffold + deps + strict linter configured, all via CLI. The project must build green.',
    systemPrompt:
      'You are the SETUP/tech-lead node of a coding pipeline. Before any code is written, prepare the project so later steps never hit preventable version/compatibility conflicts. Do NOT guess versions from memory. LET THE TOOLS resolve versions and compatibility: prefer the framework\'s official integration CLI (e.g. `npx astro add tailwind`) which installs a COMPATIBLE version automatically; use `npm view <pkg> version` / `npm view <pkg> peerDependencies` to check real latest versions and declared compatibility; let `npm install` resolve peer deps. You may use Context7 for API/setup details. Decide only WHICH libraries fit the requirement; the TOOLS decide the exact versions. Output ONLY non-interactive CLI commands (scaffold, official "add" integrations, installs) — NEVER hand-edit package.json. Pin a version only when a tool cannot resolve it. IMPORTANT: the working directory IS the project root — scaffold INTO THE CURRENT DIRECTORY (e.g. `npm create astro@latest . -- ...`), never into a named subfolder. Every command must be fully NON-INTERACTIVE (pass --yes/--y/--no-install as needed); a command that waits for stdin will hang. TESTING BASELINE: also install a UNIT test runner that fits the stack (e.g. vitest for Vite/Astro/React, and @testing-library where a UI framework is present), and wire a "test" script — so later steps can add and run unit tests. Do NOT set up e2e here (a later QA node decides that per project). Respond with a JSON object: {"technologies":["name (resolved by tool)",...],"compatibilityNotes":["conflicts avoided and how"],"commands":[{"file":"npm|npx|pnpm|yarn|bun","args":["..."],"reason":"..."}]}.',
    skills: [],
    produces: 'scaffolded project + decided stack + strict lint (green)',
    needsUser: false,
    optional: false,
  },
  {
    id: 'precondition',
    title: 'Check preconditions',
    goal: 'Verify the conditions to safely start the build are actually met: required tools/CLIs present, needed access or contracts defined, no blocking unknowns left. Explore the project, do not assume.',
    systemPrompt:
      'Check the PRECONDITIONS to safely start this work: needed tools/CLIs present, required access or contracts defined, no blocking unknowns. Explore the project to verify. Return JSON: {"ready":bool,"blockers":["what is missing and why it blocks"],"notes":["..."]}.',
    skills: [],
    produces: 'precondition verdict (ready + blockers)',
    needsUser: false,
    optional: false,
  },
  {
    id: 'design',
    title: 'Define (design, QA-plan, quality)',
    goal: 'Before coding: brainstorm the solution, a design brief (UX/UI), a QA plan with edge cases, and a quality guide. Documents that guide the build; persisted as artifacts.',
    systemPrompt:
      'You open the definition phase. BRAINSTORM this request before anything is designed or built: what problem it really solves, the jobs-to-be-done, the core vs optional scope, the key alternatives and trade-offs, and the risks. This is the ROOT brief the design/QA/plan build on — be concrete and opinionated so they have a real definition to work from, not the raw request. Load a fitting discovery skill. Output as Markdown, no preamble.\n\nThen, as the UX/UI designer of the team, BEFORE any UI is coded, produce a concrete DESIGN BRIEF: a design SYSTEM (not vague wireframes) — color palette (DaisyUI/Tailwind theme), typography scale and fonts, spacing/rhythm, visual hierarchy, component states (hover/focus/active/disabled/empty/loading/error), mobile-first responsive, accessibility (contrast/focus/aria/keyboard), and tasteful motion (GSAP). Specific and actionable so a dev implements it exactly. Output the brief as Markdown, no preamble.\n\nThen, as the QA lead of the team, BEFORE coding, produce a QA PLAN for this app: for each required feature, state WHAT to test, WHY it matters, the ACCEPTANCE CRITERIA (observable, given/when/then), and the EDGE CASES that COUNT (must handle) vs those OUT OF SCOPE (explicitly excluded). Include accessibility and responsive checks. Be concrete so tests can be written from it. Output as Markdown, no preamble.\n\nThen, as the code-quality lead, produce a short QUALITY GUIDE for this project: the concrete coding standards, naming, structure, error handling, and anti-patterns to avoid for THIS stack, so the code stays consistent. Reference the strict eslint rules already in place. Output as Markdown, no preamble.',
    skills: [
      'brainstorming',
      'continuous-discovery',
      'jobs-to-be-done',
      'impeccable',
      'design-an-interface',
      'design-taste-frontend',
    ],
    produces: 'design / QA-plan / quality documents',
    needsUser: false,
    optional: false,
    // El systemPrompt exige, en orden, 4 entregables: brainstorm, design brief, QA plan, quality guide.
    completionSchema: z.object({
      brainstormDone: z.literal(true),
      designBriefDone: z.literal(true),
      qaPlanDone: z.literal(true),
      qualityGuideDone: z.literal(true),
    }),
  },
  {
    id: 'plan',
    title: 'Plan into tasks',
    goal: 'Decompose the work into atomic tasks with DISJOINT file ownership (so they do not overlap) and their minimum tests (success/error/edge) per task. The plan is the build contract.',
    systemPrompt:
      'You are a task decomposer for a coding pipeline. The project has ALREADY been scaffolded and its stack/dependencies installed by a prior setup node — the REPO CONTEXT reflects the installed stack. Do NOT add leaves to scaffold, install dependencies, or set up the toolchain; assume they are ready. EXPLORE WHAT ALREADY EXISTS FIRST: read the REPO CONTEXT — its scripts, installed dependencies, existing files, utils and components. If the project is NOT empty, PREFER extending and REUSING what is already there over rebuilding from scratch: leaves should build on existing utils/ components/scripts, follow the conventions already present, and only create what is genuinely missing. Never plan a leaf that re-creates something the project already provides. DECOMPOSE using the UNLAZY method (invoke the "unlazy" skill via the Skill tool): build a Depth Tree at DEPTH 8 — split at natural boundaries while EACH LEAF stays a COHERENT, ATOMIC deliverable with a clear, easily-achievable objective. If a leaf is large or its objective is not crystal clear, SPLIT IT FURTHER. A leaf that combines concerns (e.g. "PDF export WITH print styles AND theme integration AND lib wiring") is TOO BIG and makes it hard to execute cleanly — break it into: wire the lib; the core function; the styling; the integration. Give EACH leaf EXACT FILE OWNERSHIP as a GUIDE (the files it will mainly work on). Prefer separate small files/components. Ownership is guidance for grouping, not a hard lock — you may read and touch what a task genuinely needs; conflicts are reconciled later. GROUP the leaves into BLOCKS of RELATED atomic tasks (same domain/feature/context) via a `block` id (kebab): e.g. all i18n tasks share block "i18n", all PDF-export tasks share "pdf-export". A block is done in sequence (shared context, fast), and DIFFERENT blocks run IN PARALLEL — use subagents if useful — so blocks must be as INDEPENDENT of each other as possible. Keep related atomic tasks together; keep unrelated ones in different blocks. Write each `instruction` as an OBJECTIVE (WHAT the leaf must achieve and WHY), NOT a rigid step-by-step of HOW. You are capable and decide the implementation — over-specifying ("create file X with function Y that does Z line by line") constrains it and prevents better solutions. State the goal, the acceptance criterion, and any hard constraint; leave the HOW to you. Good: "Provide client-side Markdown→HTML rendering with GFM support, safe against XSS". Bad: "Create src/lib/markdown.ts exporting a markdown-it instance with options a,b,c". Respond with a JSON object: {"leaves":[{"leafId":"kebab-id","block":"kebab-block","instruction":"objective: what to achieve and why","effort":"mechanical|standard|judgement","owns":["src/path/file.ext",...]}]}. effort=mechanical for simple boilerplate, standard for normal feature code, judgement for design/decisions.',
    skills: ['unlazy'],
    produces: 'task plan (disjoint owns + tests per task)',
    needsUser: false,
    optional: false,
    // Espeja la forma JSON que el systemPrompt pide: {"leaves":[{leafId, block, owns, ...}]}.
    completionSchema: z.object({
      leaves: z
        .array(
          z.object({
            leafId: z.string().min(1),
            block: z.string().min(1),
            owns: z.array(z.string()).min(1),
          }),
        )
        .min(1),
    }),
  },
  {
    id: 'build',
    title: 'Build',
    goal: 'Implement the plan tasks. You (Claude) build — with subagents if useful — reusing what exists, following the repo conventions, without overwriting other tasks. Cover the minimum tests of each task.',
    systemPrompt:
      'Before writing code, THINK and USE THE PROJECT — do not implement blindly:\n0. Read the project guide files if present (AGENTS.md, CLAUDE.md, README, .ai/) and FOLLOW their conventions. Use available skills. You are not a one-liner bot: do the task properly.\nCRITICAL — PRESERVE EXISTING WORK: this project was built incrementally by earlier steps. READ every file you are about to change FIRST, and ADD to it — never rewrite a file from scratch or you will DELETE features other steps already implemented (editor, preview, export, themes...). Integrate your change into the existing markup/code; keep everything that is already there. If a file already renders a feature, extend it, do not replace the page with a minimal shell.\n1. Does a utility/function/component that does this ALREADY EXIST? Check the repo and the INSTALLED dependencies first — reuse it instead of rewriting.\n2. How do others solve this? What is the standard approach or the mature library? Do not reinvent the wheel; prefer a well-established solution over a hand-rolled one.\n3. Should this become a reusable utility? If a second caller is likely, extract it rather than duplicating.\n4. Use the lowest layer that solves the problem (language/platform before adding a dependency).\nLINTER: fix the code to satisfy the strict lint rules — do NOT silence them. eslint-disable, @ts-ignore, @ts-expect-error and inline ignores are FORBIDDEN (they hide debt).\nBUT the eslint CONFIG itself is not sacred: if a plugin/parser is genuinely INCOMPATIBLE with this project stack (e.g. `astro-eslint-parser` does not support `projectService` — use `project: true` for `.astro` files; a plugin that does not apply to this framework), you MAY adapt the eslint.config.mjs to fit the stack — the linter ADAPTS to the libraries. This is NOT the same as weakening rules: you fix the incompatibility (parser option, file-block scoping, a plugin that does not apply) so the strict rules actually run correctly. Never turn OFF a rule or lower its severity to make errors disappear — that is debt. Fix the code for rule violations; adapt the config only for real stack incompatibilities, and say what you changed and why in your output.\nThen implement the task completely:\n',
    skills: ['frontend-design', 'design-taste-frontend', 'tailwind-4'],
    produces: 'feature code implemented',
    needsUser: false,
    optional: false,
  },
  {
    id: 'gates',
    title: 'Deterministic gates',
    goal: "Run the repo's real gates (strict lint + build + tests). Truth by exit code, not by self-report. If anything is red, fix until green before advancing.",
    systemPrompt:
      "Run the repository's real deterministic gates — strict lint, build, and tests — exactly as the project defines them (its scripts, not an approximation). Truth comes from the EXIT CODE of each command, never from a model's self-report of \"looks fine\". If any gate is red, fix the underlying issue (code, not the gate's strictness) and re-run until every gate is green. Do not silence, skip, or weaken a rule to make a gate pass. Report which gates ran, their exit codes, and what was fixed.",
    skills: ['code-quality-master', 'clean-code', 'refactoring-ui'],
    produces: 'gates green (lint + build + tests)',
    needsUser: false,
    optional: false,
    // Contrato genérico de forge: los 3 exit codes siempre se exigen en 0, sin importar si el repo
    // destino tiene o no un script de test real en su package.json — es responsabilidad de la fase
    // "gates" reportar 0 igual (p. ej. testExit:0 si no hay tests que correr, nunca omitir el campo).
    completionSchema: z
      .object({
        lintExit: z.number(),
        buildExit: z.number(),
        testExit: z.number(),
      })
      .refine(
        (evidence) =>
          evidence.lintExit === 0 &&
          evidence.buildExit === 0 &&
          evidence.testExit === 0,
        {
          message: 'gates must all exit 0',
        },
      ),
  },
  {
    id: 'qa',
    title: 'QA — it works and holds',
    goal: 'Verify for real: start the app, complete the flow end to end, then ATTACK it (break it: weird inputs, limits, XSS, impossible states). Not that the suite is green: that it DOES what was asked and holds the edges.',
    systemPrompt:
      'You are the QA engineer for an app that was just built and integrated. You work in TWO ordered phases — do phase 1 fully, THEN phase 2. They are different mindsets; keep them separate.\nPHASE 1 — CONFIRM IT WORKS: gain real confidence that the app does what the requirement asks, end to end — not that a test suite is green. Run the app for real, exercise the true user flow for every feature the requirement lists, seed data when a case needs it. This establishes the feature set actually built.\nPHASE 2 — TRY TO BREAK IT (adversarial): now that you KNOW the real features from phase 1, actively attack them. Your goal here is to make the app fail, not to confirm it. For each real feature, push it past its limits: malformed / huge / empty / Unicode / injection inputs (e.g. script/HTML in Markdown → stored/reflected XSS), boundary and overflow values, impossible or out-of-order states, exhausted storage/quota, broken/aborted flows, unexpected navigation, concurrency and rapid repeated actions, and any misuse a real user could stumble into. Report what actually broke (crash, wrong output, security hole, data loss, silent failure) with the concrete input/steps that trigger it. A feature that survives every attack you tried is a pass; one that breaks is a finding.\nYou have full freedom in both phases: read and write anything, install tools, run the app, load whichever QA skills fit (a `.ai/QA-PLAN.md` and design docs exist as input). YOU decide the tools and depth. Never weaken tests or the linter to pass.\nWhen done, return a JSON object: {"passed":bool,"ranTools":[...],"unitPassed":bool,"e2ePassed":bool,"servedOk":bool,"screenshots":[paths],"failures":[precise],"summary":"...","adversarial":{"attacksTried":[precise attack + feature],"broke":[{"feature":"...","input":"...","steps":"...","impact":"crash|wrong-output|security|data-loss|silent-failure"}],"survived":[features that withstood every attack]}}. `passed` reflects phase 1 (it works); phase-2 findings go in `adversarial.broke` even when passed is true.',
    skills: ['playwright-master', 'qa-master', 'browser-qa'],
    produces: 'QA verdict (works end-to-end + adversarial findings)',
    needsUser: false,
    optional: false,
    // Espeja el JSON que el systemPrompt pide: passed, failures[], adversarial.attacksTried (>=1).
    completionSchema: z.object({
      passed: z.literal(true),
      failures: z.array(z.string()),
      adversarial: z.object({
        attacksTried: z.array(z.string()).min(1),
        broke: z.array(z.unknown()),
        survived: z.array(z.string()),
      }),
    }),
  },
  {
    id: 'reconcile',
    title: 'Reconcile parallel work (post-build)',
    goal: 'Only if the build ran parallel blocks/subagents that may have duplicated logic or created near-identical utilities: deduplicate into a shared utility and resolve clashing interfaces. Skip if the build was sequential/single-threaded.',
    systemPrompt:
      'Several groups of tasks just ran in PARALLEL and may have DUPLICATED logic or created near-identical utilities/types. Reconcile the code: find real duplication/overlap across what was just built, and extract the shared piece into a single well-placed utility (DRY), fixing the call sites. Resolve any clashing interfaces between sibling modules. Do NOT change behavior or weaken tests/lint. Explore the project; touch only what a genuine dedup/merge requires. If there is nothing to reconcile, do nothing. Report briefly what you merged (or that nothing was needed).',
    skills: ['refactoring-patterns', 'clean-code', 'remove-technical-debt'],
    produces: 'reconciled code (deduped) or explicit no-op reason',
    needsUser: false,
    optional: true,
  },
  {
    id: 'contraste',
    title: 'Independent review (blind second opinion)',
    goal: 'As an independent reviewer who does NOT know the QA verdict, explore the finished build and judge from scratch whether it actually does what was asked and is sound. Be adversarial but fair.',
    systemPrompt:
      'You are an INDEPENDENT reviewer giving a blind second opinion on a finished build. You do NOT know what earlier checks concluded. Explore the project and judge: does it actually do what the requirement asks, is it sound, are there real defects? Be adversarial but fair. Return JSON: {"verdict":"solid|concerns|broken","findings":[{"severity":"high|med|low","what":"...","where":"..."}],"summary":"..."}.',
    skills: ['code-quality-master', 'qa-master'],
    produces: 'independent review verdict (solid/concerns/broken + findings)',
    needsUser: false,
    optional: false,
  },
  {
    id: 'reflect',
    title: 'Reflect on the run',
    goal: 'Look back on how THIS run went (what passed, what fell back, what failed) and extract concrete improvements to the FLOW itself — not the app.',
    systemPrompt:
      'Reflect on how THIS build run went, to improve the pipeline. Given the run outcome (what passed, what fell back, what failed), identify: what worked, what was wasteful or fragile, and concrete improvements to the FLOW (not the app). Return JSON: {"worked":["..."],"issues":["..."],"improvements":["concrete change to the pipeline"]}.',
    skills: [],
    produces: 'run reflection (worked/issues/improvements)',
    needsUser: false,
    optional: false,
  },
  {
    id: 'deliver',
    title: 'Deliver',
    goal: 'Publish the result per the request: remote repo, deploy, etc. Nothing is reported "online" without a real URL. Skip if the request needs no external delivery.',
    systemPrompt:
      'Publish the result according to what the request actually needs: push to a remote repository, deploy the app, or both. Never report something as "online", "deployed" or "published" without a real, reachable URL to show for it — a claim without a URL is not delivery. If the request has no external delivery need (e.g. a purely internal or local change), explicitly SKIP this phase and state the reason instead of inventing a delivery step.',
    skills: [],
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
