# forge-mcp

**The director of the forge pipeline.** An MCP server that tells Claude Code *which phase to
run next and what it must produce*, then validates the evidence before letting the flow
advance. **Claude is the executor** — forge never runs the work itself. It directs, you build.

🇪🇸 [Léelo en español](./README.es.md)

---

## The idea

A long piece of work — design a feature, build it, test it, ship it — is easy to do out of
order, skip a step of, or declare "done" without proof. forge turns that flow into a
**pipeline of phases** that can only advance in order, and only when each phase hands back
real evidence.

- forge **says which phase is next** and exactly what it expects from it (the full criteria,
  not a summary).
- **You (Claude) execute** the phase — reading code, writing it, running tests, asking the
  user when a decision is theirs.
- You **report the phase done** with evidence; forge **validates** it and **advances**.
- You **cannot skip a phase**, cannot close one with empty or fake evidence, and cannot
  finish before every phase is closed.

The state lives in **SQLite** (`node:sqlite`, a Node built-in — no native build step), so a
run **resumes in any session**: Claude's context does not survive a close, a compaction or
picking up the next day — the flow's state does.

---

## The 13 phases

```
classify → clarify → setup → precondition → design → plan → build
        → gates → qa → reconcile → contraste → reflect → deliver
```

| Phase | What it does | Asks the user | Optional |
|---|---|:-:|:-:|
| `classify` | Classify the request's nature (QUESTION / MICRO / STANDARD / HIGH-RISK) and scope. | | |
| `clarify` | Detect ambiguities that change the product; bring the important ones to the user with options and consequences. | **yes** | |
| `setup` | Decide the stack and its REAL versions (via `npm view` / official CLIs, never from memory); scaffold, install deps, strict linter. | | |
| `precondition` | Verify the conditions to safely start the build are actually met (tools present, env ready). | | |
| `design` | Before coding: brainstorm the solution, a UX/UI design brief, a QA plan with edge cases, a code-quality guide — persisted as artifacts. | | |
| `plan` | Decompose the work into atomic tasks with disjoint file ownership, grouped into independent blocks. | | |
| `build` | Implement the plan. You build — reusing what exists, never rewriting a whole file, respecting the strict linter. | | |
| `gates` | Run the repo's real gates (strict lint + build + tests). Truth is the exit code, not the model's self-report. | | |
| `qa` | Verify for real: run the app end to end, then ATTACK it (odd inputs, limits, impossible states) and report what broke. | | |
| `reconcile` | Only if parallel work may have duplicated logic or created conflicts — resolve them. | | **yes** |
| `contraste` | An independent review that does NOT know the QA verdict, exploring the finished build with fresh eyes. | | |
| `reflect` | Look back on how this run went (what passed, what fell back, what failed) and extract lessons. | | |
| `deliver` | Publish per the request (remote push, deploy). Never reports "online" without a real URL; skips explicitly with a reason if it does not apply. | | **yes** |

Each phase carries a `goal` (short instruction), a full `systemPrompt` (the complete criteria
for that phase), the `skills` to load before running it, and flags for whether it needs the
user or is optional. All defined in `src/phases.ts`.

---

## Evidence is validated, not trusted

forge does not accept "done" as a string. `forge_complete_phase` validates the **evidence**
each phase must hand back, and rejects the close if it does not hold up:

- `gates` requires the real exit codes (lint / build / test) and they must all be `0`.
- `qa` requires a structured result: it passed, and it was actually attacked.
- `clarify` (a user decision) requires an explicit `userConfirmed`.
- An **optional** phase can only be skipped with a stated reason.

So a phase cannot be closed with an invented summary. The pipeline advances on proof.

---

## The skills library (128)

`src/skills.ts` + the `skills/` folder ship 128 skills, each with its own `SKILL.md`,
versioned in the repo (forge is self-contained — it does not depend on anything external for
these). Each phase declares which skills it loads; the domain map (`SKILL_MAP`) says which
skills belong to which domain. Skills load **on demand** — Claude asks for the list with
`forge_skills` and the content of a specific one with `forge_skill(name)`, never all at once.

---

## The 7 tools

| Tool | What it does |
|---|---|
| `forge_start(request, cwd)` | Start a new run; returns the first phase (`classify`) and its goal. |
| `forge_status(runId?)` | Which phase a run is in and its progress (`[x]` closed, `[>]` current, `[ ]` pending). |
| `forge_next(runId?)` | The CURRENT phase with its detailed goal, full `systemPrompt`, and skills to load. |
| `forge_complete_phase(runId?, summary, evidence)` | Close the current phase with a summary and validated evidence, then advance. If it was the last phase, mark the run `done`. |
| `forge_tasks()` | List active runs — to resume from any session without re-reading context. |
| `forge_skills(phase?)` | List the full skills library, or filtered by domain if a phase is given. |
| `forge_skill(name)` | Return a specific skill's `SKILL.md` for Claude to load and apply. |

---

## Install

```bash
git clone https://github.com/DevRik99/forge-mcp
cd forge-mcp
npm install
npm run build
```

Register it in Claude Code (`.mcp.json` or project config):

```json
{ "mcpServers": { "forge": { "command": "node", "args": ["dist/server.js"] } } }
```

Requires **Node ≥ 22.5** (for `node:sqlite`).

---

## How a run resumes

The state lives in a single **global** SQLite DB at `~/.forge/forge-mcp.db` (override with
`FORGE_MCP_DB`), so every project shares one store and runs are told apart by their `cwd`.
Two tables:

- `runs`: one row per run (`id`, `request`, `cwd`, `current_phase`, `status`, timestamps).
- `phase_artifacts`: one row per closed phase (`run_id`, `phase`, `summary`, `closed_at`) —
  the real decision/artifact Claude reported, not just a boolean flag.

After a lost session (close, compaction, next day), any new Claude session with this MCP
connected can:

1. Call `forge_tasks()` to see which runs are still active and in what phase.
2. Call `forge_next(runId)` to get the current phase's full `systemPrompt` again — Claude
   does not need to remember anything; forge hands it back verbatim.
3. Read the closed phases' artifacts via `forge_status` so nothing already decided (e.g. in
   `clarify`) is re-asked.

---

## Guarantees (and honest limits)

forge **enforces**: the phase order, closing every phase before finishing, and validated
evidence per phase (no fake `gates`/`qa`, no skipping user decisions or optional phases
without a reason). Under concurrency, closing a phase is atomic — a stale double-close is
rejected, not silently applied.

forge **cannot** stop you from editing the project *without* using it at all — an MCP only
sees its own tools, not your `Edit`/`Write`/`Bash`. To force every change through the
pipeline, pair it with the `forge-flow` gate from
[claude-gates](https://github.com/DevRik99/claude-gates), which blocks edits when no forge
run is active.

## License

MIT.
