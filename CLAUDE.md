<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Worktree workflow

When adding a new feature, do the work in a new git worktree branched off `main` — do not work directly on `main` unless explicitly told to. If it's unclear whether a change should go straight to `main` or into a worktree, ask before proceeding.

Flow:

1. Create a new worktree branched from `main`.
2. Copy `.env` into the new worktree as-is — do not open or inspect its contents.
3. Run `npm i` in the new worktree to install dependencies.
4. Do the work in the worktree.
5. Merge back into `main` when done.

Skip setting up the Go CLI (`cli/`) in worktrees — it's deprecated code kept only for reference.

# .env

Never read or open `.env` (or copies of it) — it holds secrets. Copy it between worktrees as an opaque file only; don't `cat`, `Read`, `grep`, or otherwise inspect its contents. If you need to know which variables are required, derive that from code (`process.env.X` references) or a checked-in `.env.example`, not from `.env` itself.

The config module (wherever env vars are read in code, e.g. a `config`/`env` module) is the source of truth for what variables exist and how they're used — not `.env` itself. Prefer sane defaults in the config module for anything that can reasonably have one, so `.env` only needs to carry real secrets and environment-specific overrides. It's the user's responsibility to keep their own `.env` in sync with whatever the config module expects; don't try to infer or validate `.env`'s contents yourself.
