# docs/ structure

See `index.md` for the full map. In short:

- `index.md` — what lives where in this folder.
- `styling.md` — the UI styling and theme standards: theme tokens
  (`src/styles/theme.css`), the `PageLayout`/`PageHeader` primitives, and which of
  the three seams a visual change belongs at. **Read this before changing any CSS,
  Tailwind class, or UI component**, and keep it current when the system changes.
- `database.md` — manual Prisma/Postgres operations, migration workflow, and
  destructive-operation safeguards.
- `ai.md` — living source of truth for semantic AI actions, provider adapters,
  per-action bindings, prompt ownership, deterministic fakes, and extension
  rules. Read and update it for any AI subsystem change.
- `plans/completed/` — implemented plans, numbered in build order
  (`00-overview.md` is the architecture map; the rest are one plan per feature).
  Read these to understand how an existing subsystem was built.
- `plans/open/` — plans not yet implemented. A plan moves to `completed/` once
  merged to `main`.

Plans are pre-implementation specs and are not updated afterwards — for current
behavior, read the code. Reference docs (`styling.md`, `database.md`, and
`ai.md`) are living and should be kept accurate. In particular, do not use a
historical AI plan as the current action/provider map; maintain `ai.md` instead.

`AGENTS.md` in this folder is a symlink to this file; edit only `CLAUDE.md`.

See the root `CLAUDE.md` for the worktree and plan → judge → fix workflow that
consumes these plans.
