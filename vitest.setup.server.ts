import { testConfigEnv } from "@/server/config"

// Server tests import `src/server/config.ts`, which validates env at load time
// (`auth.ts` calls `getConfig()` at module top-level). Vitest does not load
// `.env.local`, and the suite must never run against real secrets, so apply the
// fake config env — colocated with the schema in `config.ts` — before any
// server module is imported. Unconditional assignment: a real `.env` (worktrees
// copy one in) is deliberately overridden.
for (const [key, value] of Object.entries(testConfigEnv())) {
  process.env[key] = value
}
