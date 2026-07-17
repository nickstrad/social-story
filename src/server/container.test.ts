import { describe, expect, it } from "vitest"

import { createFakeAiActions } from "./ai/testing/fakes"
import { parseConfig } from "./config"
import { createDeps } from "./container"
import { inMemoryRepos } from "./repos/memory"
import { inMemoryStorage } from "./services/memory-storage"
import type { Deps } from "./container"
import { immediateDispatcher } from "./services/fakes"

describe("Deps", () => {
  it("supports fully in-memory test dependencies", () => {
    const deps: Deps = {
      repos: inMemoryRepos(),
      storage: inMemoryStorage(),
      ai: createFakeAiActions(),
      dispatcher: immediateDispatcher(async () => {}),
    }
    expect(deps.repos.stories).toBeDefined()
    expect(deps.storage.put).toBeTypeOf("function")
    expect(deps.ai.storyToData.convert).toBeTypeOf("function")
    expect(deps.ai.characterPhotoAutofill.suggest).toBeTypeOf("function")
    expect(deps.ai.baseImage.generate).toBeTypeOf("function")
    expect(deps.ai.pageImage.generate).toBeTypeOf("function")
    expect(deps.ai.coverImage.generate).toBeTypeOf("function")
    expect(deps.dispatcher.dispatch).toBeTypeOf("function")
  })

  it("wires adapters from parsed configuration", () => {
    const config = parseConfig({
      DATABASE_URL: "https://database.example.com",
      OPENAI_TOKEN: "openai-token",
      BLOB_READ_WRITE_TOKEN: "blob-token",
      BETTER_AUTH_SECRET: "auth-secret",
      BETTER_AUTH_URL: "https://app.example.com",
    })

    const deps = createDeps(config)
    expect(deps.repos.pages.listByStory).toBeTypeOf("function")
    expect(deps.storage.fetchBuffer).toBeTypeOf("function")
    expect(deps.ai.storyToData.convert).toBeTypeOf("function")
    expect(deps.ai.baseImage.generate).toBeTypeOf("function")
  })
})
