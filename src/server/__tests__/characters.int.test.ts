// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import type { Deps } from "@/server/container"
import { createTestCaller } from "@/server/api/test-utils"
import { inMemoryRepos } from "@/server/repos/memory"
import {
  fakeImageGenerator,
  fakeTextGenerator,
  immediateDispatcher,
} from "@/server/services/fakes"
import { inMemoryStorage } from "@/server/services/memory-storage"

// Self-sufficient integration test: in-memory repos + fake adapters, no real
// Postgres and no external APIs. Real-DB coverage lives in the Playwright E2E
// suite (docs/13-e2e-playwright.md).

const user = {
  id: "owner",
  name: "Owner",
  email: "owner@example.com",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
}
const other = {
  ...user,
  id: "other",
  email: "other@example.com",
}
const deps = (): Deps => ({
  repos: inMemoryRepos(),
  storage: inMemoryStorage(),
  text: fakeTextGenerator({}),
  image: fakeImageGenerator(),
  dispatcher: immediateDispatcher(async () => {}),
})

describe("character and rule routers", () => {
  it("CRUDs records, cleans rules and blobs, and hides other users' stories", async () => {
    const services = deps()
    const deleteBlob = vi.spyOn(services.storage, "delete")
    const caller = createTestCaller({ user, deps: services })
    const story = await services.repos.stories.create({
      userId: user.id,
      title: "Trip",
      script: "A trip",
    })
    const first = await caller.character.create({
      storyId: story.id,
      character: { name: "Allison" },
    })
    const second = await caller.character.create({
      storyId: story.id,
      character: { name: "Ezra" },
    })
    const blob = await services.storage.put(
      "photo",
      Buffer.from("photo"),
      "image/png"
    )
    const asset = await services.repos.assets.create({
      userId: user.id,
      storyId: story.id,
      kind: "CHARACTER_PHOTO",
      storageLocator: blob.locator,
      contentType: "image/png",
      byteLength: 5,
    })
    await services.repos.characters.update(first.id, {
      photoAssetId: asset.id,
    })
    const rule = await caller.rule.create({
      storyId: story.id,
      rule: {
        kind: "TOGETHER",
        text: "Together",
        characterIds: [first.id, second.id],
      },
    })
    expect(
      await caller.character.listForStory({ storyId: story.id })
    ).toHaveLength(2)
    await caller.rule.update({
      storyId: story.id,
      ruleId: rule.id,
      rule: {
        kind: "TOGETHER",
        text: "Always together",
        characterIds: [first.id, second.id],
      },
    })
    await caller.character.delete({ storyId: story.id, characterId: first.id })
    expect(deleteBlob).toHaveBeenCalledWith(blob.locator)
    expect(
      (await caller.rule.listForStory({ storyId: story.id }))[0].characterIds
    ).toEqual([second.id])
    await caller.rule.delete({ storyId: story.id, ruleId: rule.id })
    await expect(
      createTestCaller({ user: other, deps: services }).character.listForStory({
        storyId: story.id,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})
