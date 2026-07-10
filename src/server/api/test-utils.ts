import { appRouter } from "./root"
import type { Context } from "./trpc"

import type { Deps } from "@/server/container"
import { inMemoryRepos } from "@/server/repos/memory"
import { fakeImageGenerator, fakeTextGenerator } from "@/server/services/fakes"
import { inMemoryStorage } from "@/server/services/memory-storage"
import { immediateDispatcher } from "@/server/services/fakes"

type User = NonNullable<Context["session"]>["user"]

function defaultDeps(): Deps {
  return {
    repos: inMemoryRepos(),
    storage: inMemoryStorage(),
    text: fakeTextGenerator({}),
    image: fakeImageGenerator(),
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
