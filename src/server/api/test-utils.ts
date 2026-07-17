import { appRouter } from "./root"
import type { Context } from "./trpc"

import type { Deps } from "@/server/container"
import { createFakeAiActions } from "@/server/ai/testing/fakes"
import { inMemoryRepos } from "@/server/repos/memory"
import { inMemoryStorage } from "@/server/services/memory-storage"
import { immediateDispatcher } from "@/server/services/fakes"

type User = NonNullable<Context["session"]>["user"]

function defaultDeps(): Deps {
  return {
    repos: inMemoryRepos(),
    storage: inMemoryStorage(),
    ai: createFakeAiActions(),
    dispatcher: immediateDispatcher(async () => {}),
  }
}

export function createTestCaller({
  user = null,
  deps = defaultDeps(),
}: {
  user?: User | null
  deps?: Deps
} = {}) {
  return appRouter.createCaller({
    deps,
    session: user ? { user } : null,
  })
}
