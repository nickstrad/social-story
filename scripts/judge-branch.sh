#!/usr/bin/env bash
# Judge a worktree's work against its plan using the fable model, non-interactively.
# Reads CHANGE_SUMMARY.md at the worktree root, diffs the branch against main,
# and writes JUDGEMENT.md at the worktree root.
#
# Usage: scripts/judge-branch.sh [worktree-dir]   (default: current directory)
set -euo pipefail

WORKTREE="$(cd "${1:-.}" && pwd)"
SUMMARY="$WORKTREE/CHANGE_SUMMARY.md"
JUDGEMENT="$WORKTREE/JUDGEMENT.md"

[ -f "$SUMMARY" ] || { echo "error: $SUMMARY not found — run do-next-plan first" >&2; exit 1; }

cd "$WORKTREE"

PLAN_PATH=$(grep -m1 -E '^Plan:' "$SUMMARY" | sed 's/^Plan:[[:space:]]*//' | tr -d '`')
[ -n "$PLAN_PATH" ] && [ -f "$PLAN_PATH" ] || { echo "error: plan file '$PLAN_PATH' (from CHANGE_SUMMARY.md) not found" >&2; exit 1; }

BRANCH=$(git rev-parse --abbrev-ref HEAD)
BASE=$(git merge-base main HEAD)
# Everything in the worktree vs main: committed, staged, unstaged, and untracked.
git add -N . 2>/dev/null || true
DIFF=$(git diff "$BASE" -- . ':(exclude)CHANGE_SUMMARY.md' ':(exclude)JUDGEMENT.md')
[ -n "$DIFF" ] || { echo "error: no changes vs main to judge" >&2; exit 1; }

claude -p --model claude-fable-5 > "$JUDGEMENT" <<EOF
You are judging whether a branch's committed work correctly and completely implements its plan. This is a completion/correctness judgement, not a style review — flag quality issues only where they would block calling the plan "done".

Output ONLY the judgement document in exactly this markdown structure (no preamble, no code fences around it):

# Judgement — $BRANCH

Plan: $PLAN_PATH
Verdict: READY | NOT READY

## Blockers
## Should-fix
## Nits

Rules: verdict is READY only if there are no blockers. Each finding: title, file:line, what's wrong, what would resolve it. Empty section → "_none_". Judge strictly against the plan: missed requirements, correctness bugs, and out-of-scope additions all count. The diff covers everything in the worktree — committed and uncommitted.

=== THE PLAN (the spec) ===
$(cat "$PLAN_PATH")

=== IMPLEMENTER'S CHANGE SUMMARY ===
$(cat "$SUMMARY")

=== DIFF vs main ===
$DIFF
EOF

echo "wrote $JUDGEMENT"
grep -m1 '^Verdict:' "$JUDGEMENT" || true
