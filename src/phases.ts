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
 *
 * `systemPrompt` es el prompt REAL y completo de cada nodo del backend (copiado textual de
 * `backend-nodes-export.json`), para que Claude ejecute la fase con el mismo criterio que el worker
 * del backend habría recibido. `skills` son las skills de Claude Code que esa fase debe cargar.
 */

/** Una fase del pipeline: qué es, qué se espera que Claude produzca, y si puede omitirse. */
export interface Phase {
  /** Id estable de la fase (clave en el estado). */
  id: string;
  /** Nombre legible. */
  title: string;
  /** Qué debe hacer Claude en esta fase (la instrucción que el MCP le devuelve). */
  goal: string;
  /** Prompt real y completo del nodo equivalente del backend (fuente de verdad del criterio). */
  systemPrompt: string;
  /** Skills de Claude Code que esta fase debe cargar (vacío si ninguna aplica). */
  skills: string[];
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
    id: 'design',
    title: 'Define (design, QA-plan, quality)',
    goal: 'Before coding: brainstorm the solution, a design brief (UX/UI), a QA plan with edge cases, and a quality guide. Documents that guide the build; persisted as artifacts.',
    systemPrompt:
      'You open the definition phase. BRAINSTORM this request before anything is designed or built: what problem it really solves, the jobs-to-be-done, the core vs optional scope, the key alternatives and trade-offs, and the risks. This is the ROOT brief the design/QA/plan build on — be concrete and opinionated so they have a real definition to work from, not the raw request. Load a fitting discovery skill. Output as Markdown, no preamble.\n\nThen, as the UX/UI designer of the team, BEFORE any UI is coded, produce a concrete DESIGN BRIEF: a design SYSTEM (not vague wireframes) — color palette (DaisyUI/Tailwind theme), typography scale and fonts, spacing/rhythm, visual hierarchy, component states (hover/focus/active/disabled/empty/loading/error), mobile-first responsive, accessibility (contrast/focus/aria/keyboard), and tasteful motion (GSAP). Specific and actionable so a dev implements it exactly. Output the brief as Markdown, no preamble.\n\nThen, as the QA lead of the team, BEFORE coding, produce a QA PLAN for this app: for each required feature, state WHAT to test, WHY it matters, the ACCEPTANCE CRITERIA (observable, given/when/then), and the EDGE CASES that COUNT (must handle) vs those OUT OF SCOPE (explicitly excluded). Include accessibility and responsive checks. Be concrete so tests can be written from it. Output as Markdown, no preamble.\n\nThen, as the code-quality lead, produce a short QUALITY GUIDE for this project: the concrete coding standards, naming, structure, error handling, and anti-patterns to avoid for THIS stack, so every worker writes consistent code. Reference the strict eslint rules already in place. Output as Markdown, no preamble.',
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
  },
  {
    id: 'plan',
    title: 'Plan into tasks',
    goal: 'Decompose the work into atomic tasks with DISJOINT file ownership (so they do not overlap) and their minimum tests (success/error/edge) per task. The plan is the build contract.',
    systemPrompt:
      'You are a task decomposer for a coding pipeline. The project has ALREADY been scaffolded and its stack/dependencies installed by a prior setup node — the REPO CONTEXT reflects the installed stack. Do NOT add leaves to scaffold, install dependencies, or set up the toolchain; assume they are ready. EXPLORE WHAT ALREADY EXISTS FIRST: read the REPO CONTEXT — its scripts, installed dependencies, existing files, utils and components. If the project is NOT empty, PREFER extending and REUSING what is already there over rebuilding from scratch: leaves should build on existing utils/ components/scripts, follow the conventions already present, and only create what is genuinely missing. Never plan a leaf that re-creates something the project already provides. DECOMPOSE using the UNLAZY method (invoke the "unlazy" skill via the Skill tool): build a Depth Tree at DEPTH 8 — split at natural boundaries while EACH LEAF stays a COHERENT, ATOMIC deliverable with a clear, easily-achievable objective. If a leaf is large or its objective is not crystal clear, SPLIT IT FURTHER. A leaf that combines concerns (e.g. "PDF export WITH print styles AND theme integration AND lib wiring") is TOO BIG and makes any worker hang — break it into: wire the lib; the core function; the styling; the integration. Give EACH leaf EXACT FILE OWNERSHIP as a GUIDE (the files it will mainly work on). Prefer separate small files/components. Ownership is guidance for grouping, not a hard lock — a worker may read and touch what a task genuinely needs; conflicts are reconciled later. GROUP the leaves into BLOCKS of RELATED atomic tasks (same domain/feature/context) via a `block` id (kebab): e.g. all i18n tasks share block "i18n", all PDF-export tasks share "pdf-export". A block is done by ONE worker in sequence (shared context, fast), and DIFFERENT blocks run IN PARALLEL — so blocks must be as INDEPENDENT of each other as possible. Keep related atomic tasks together; keep unrelated ones in different blocks. Write each `instruction` as an OBJECTIVE (WHAT the leaf must achieve and WHY), NOT a rigid step-by-step of HOW. The worker is capable and decides the implementation — over-specifying ("create file X with function Y that does Z line by line") constrains it and prevents better solutions. State the goal, the acceptance criterion, and any hard constraint; leave the HOW to the worker. Good: "Provide client-side Markdown→HTML rendering with GFM support, safe against XSS". Bad: "Create src/lib/markdown.ts exporting a markdown-it instance with options a,b,c". Respond with a JSON object: {"leaves":[{"leafId":"kebab-id","block":"kebab-block","instruction":"objective: what to achieve and why","effort":"mechanical|standard|judgement","owns":["src/path/file.ext",...]}]}. effort=mechanical for simple boilerplate, standard for normal feature code, judgement for design/decisions.',
    skills: ['unlazy'],
    produces: 'task plan (disjoint owns + tests per task)',
    needsUser: false,
    optional: false,
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
