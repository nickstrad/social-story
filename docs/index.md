# Docs

## Structure

```
docs/
├── index.md          # this file — what lives where
├── CLAUDE.md         # agent instructions for this folder (AGENTS.md symlinks here)
├── styling.md        # UI styling & theme standards — read before touching CSS/UI
├── database.md       # guarded Prisma/Postgres operations & migration workflow
├── ai.md             # AI actions, providers, bindings, prompts, fakes & extension rules
└── plans/
    ├── completed/    # implemented plans, numbered in build order
    └── open/         # plans not yet implemented
```

## Reference docs

Living standards. Keep these current as the code changes.

- [styling.md](styling.md) — the theme tokens, layout primitives, and the rules for
  where a visual change belongs.
- [database.md](database.md) — guarded Prisma/Postgres operations, migration
  workflow, resets, and explicit dev/production targeting.
- [ai.md](ai.md) — source of truth for semantic AI actions, provider adapters,
  per-action bindings, prompt ownership, deterministic fakes, and extension rules.

## Plans

One plan per feature. A plan is a spec written before implementation; it is **not**
updated to track drift afterwards. To learn how a subsystem actually works today,
read the code — the plan tells you what was intended and why.

- `plans/completed/` — implemented, numbered in build order.
  [`00-overview.md`](plans/completed/00-overview.md) is the architecture map and the
  best entry point for a new subsystem.
- `plans/open/` — not yet implemented. A plan moves to `completed/` once it merges
  to `main`.

The root [`CLAUDE.md`](../CLAUDE.md) describes the worktree and plan → judge → fix
workflow that consumes these plans.
