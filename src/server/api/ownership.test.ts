// @vitest-environment node

import { describe, expect, it } from "vitest"

import { assertPageOwnership, assertStoryOwnership } from "./ownership"
import { inMemoryRepos } from "@/server/repos/memory"

async function expectNotFound(promise: Promise<unknown>) {
  await expect(promise).rejects.toMatchObject({
    code: "NOT_FOUND",
  })
}

describe("ownership helpers", () => {
  it("returns an owned story", async () => {
    const repos = inMemoryRepos()
    const story = await repos.stories.create({
      userId: "owner",
      title: "A visit",
      script: "We go together.",
    })

    await expect(
      assertStoryOwnership(repos, story.id, "owner")
    ).resolves.toEqual(story)
  })

  it("hides missing and other users' stories", async () => {
    const repos = inMemoryRepos()
    const story = await repos.stories.create({
      userId: "owner",
      title: "A visit",
      script: "We go together.",
    })

    await expectNotFound(assertStoryOwnership(repos, story.id, "other"))
    await expectNotFound(assertStoryOwnership(repos, "missing", "owner"))
  })

  it("returns an owned page through its story", async () => {
    const repos = inMemoryRepos()
    const story = await repos.stories.create({
      userId: "owner",
      title: "A visit",
      script: "We go together.",
    })
    const page = await repos.pages.create({
      storyId: story.id,
      kind: "PAGE",
      position: 0,
      text: "We arrive.",
      imagePrompt: "A welcoming building",
      characterIds: [],
    })

    await expect(assertPageOwnership(repos, page.id, "owner")).resolves.toEqual(
      page
    )
    await expectNotFound(assertPageOwnership(repos, page.id, "other"))
    await expectNotFound(assertPageOwnership(repos, "missing", "owner"))
  })
})
