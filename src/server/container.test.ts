import { describe, expect, it } from "vitest"

import { parseConfig } from "./config"
import { createDeps } from "./container"
import { inMemoryRepos } from "./repos/memory"
import { inMemoryStorage } from "./services/memory-storage"
import { fakeImageGenerator, fakeTextGenerator } from "./services/fakes"
import type { Deps } from "./container"
import { immediateDispatcher } from "./services/fakes"

describe("Deps", () => {
  it("supports fully in-memory test dependencies", () => {
    const deps: Deps = {
      repos: inMemoryRepos(),
      storage: inMemoryStorage(),
      text: fakeTextGenerator({}),
      image: fakeImageGenerator(),
      dispatcher: immediateDispatcher(async () => {}),
    }
    expect(deps.repos.stories).toBeDefined()
    expect(deps.storage.put).toBeTypeOf("function")
    expect(deps.text.generateJson).toBeTypeOf("function")
    expect(deps.image.generate).toBeTypeOf("function")
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
    expect(deps.text.generateJson).toBeTypeOf("function")
    expect(deps.image.generate).toBeTypeOf("function")
  })
})
