<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Worktree workflow

New features go in a new git worktree branched off `main` — never directly on `main` unless explicitly told to. If unsure which applies, ask.

Flow:

1. Create a worktree branched from `main`.
2. Copy `.env` into it as-is — do not open or inspect it.
3. Run `npm i`.
4. Do the work.
5. Merge back into `main` when done.

Skip the Go CLI (`cli/`) in worktrees — deprecated, kept for reference only.

## Plan → judge → fix workflow

When implementing a plan from `docs/`, use this skill chain instead of working freehand. Each step is triggered manually by the user — never chain into the next step automatically:

1. `/do-next-plan <plan file>` — implements the plan in a new worktree, runs `/simplify`, writes `CHANGE_SUMMARY.md` at the worktree root naming the source plan.
2. `/judge-branch` — runs `scripts/judge-branch.sh`: the `fable` model judges the full worktree diff (committed and uncommitted) against the plan in a fresh `claude -p` context and writes `JUDGEMENT.md` at the worktree root.
3. `/handle-judge-feedback` — implements `JUDGEMENT.md`'s feedback in priority order.

The pipeline stops and asks rather than pushing past blockers it can't resolve (missing `.env` values, migrations that can't run, services needing provisioning). Nothing merges to `main` — that's always a separate, explicit action.

# .env

Never read, `cat`, `grep`, or otherwise inspect `.env` (or copies) — it holds secrets. Copy it between worktrees as an opaque file only. To learn which variables are required, read the code (`process.env.X` references) or a checked-in `.env.example`.

The config module (wherever env vars are read in code) is the source of truth for what variables exist and how they're used. Give config values sane defaults where possible, so `.env` only carries real secrets and environment-specific overrides. Keeping `.env` in sync with the config module is the user's job — don't try to infer or validate its contents.
