## graphify

This project has a knowledge graph skill installed at `.agents/skills/graphify/SKILL.md` (and `.claude/skills/graphify/SKILL.md` for Claude Code) with god nodes, community structure, and cross-file relationships at `graphify-out/`.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- When `graphify-out/graph.json` exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. When the answer is under a Markdown heading, `graphify section "<heading>"` prints that section's text, so the `.md` need not be opened. These return a scoped subgraph, usually much smaller than `GRAPH_REPORT.md` or raw grep output.
- Dirty `graphify-out/` files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If `graphify-out/wiki/index.md` exists, use it for broad navigation instead of raw source browsing.
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed `graphify-out/graph.json` is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.

## design-taste-frontend (Taste Skill)

The **Taste Skill** (`tasteskill 2.5.1`) is installed at `.agents/skills/design-taste-frontend/SKILL.md` (with bundled `references/`, `library/`, `assets/`, and verification `scripts/`).

- When building, designing, redesigning, restyling, polishing, or reviewing a landing page, marketing site, or frontend UI (or when the user invokes `/design-taste-frontend` / asks to use Taste Skill), read `.agents/skills/design-taste-frontend/SKILL.md` first and follow its design rules, references, and browser verification scripts (requires Node 22+ and Chrome/Edge/Chromium locally).

## Emil Kowalski Design Engineering Skills (`emilkowalski/skills`)

Installed directly under `.agents/skills/`: `emil-design-eng` (with `ui-cheatsheet.md` & `performance-cheatsheet.md`), `animate`, `animate-expo`, `animation-performance`, `animation-vocabulary`, `apple-design`, `ask-emil`, `ask-sonner`, `break-ui`, `choreograph`, `find-animation-opportunities`, `gestures`, `improve-animations`, `learn-taste`, `mobile-native`, `pick-ui-library`, `prototype`, `remove-animations`, `review-animations`, and `write-swift`.

- Applied live in the Admin Preview Lab as **Craft `v1.1.0`** (`src/preview/v110/`).
- When building or refining animations, micro-interactions, drawers/sheets, or mobile-native touch physics, read the matching `.agents/skills/<skill>/SKILL.md` first.

## Matt Pocock Engineering & Productivity Skills (`mattpocock/skills`)

Installed directly under `.agents/skills/`: `ask-matt`, `codebase-design`, `code-review`, `diagnosing-bugs`, `domain-modeling`, `grill-me`, `grill-with-docs`, `grilling`, `handoff`, `implement`, `implement-spec`, `improve-codebase-architecture`, `mp-prototype`, `pr`, `research`, `retro`, `setup-matt-pocock-skills`, `tdd`, `teach`, `to-questionnaire`, `to-spec`, `to-tickets`, `triage`, `wait-what`, `wayfinder`, `wizard`, `writing-for-agents`, `git-guardrails-claude-code`, `migrate-to-shoehorn`, `scaffold-exercises`, and `setup-pre-commit`.


