import { describe, expect, it } from "vitest"

import { inMemoryRepos } from "./memory"

describe("inMemoryRepos", () => {
  it("roundtrips aggregates and maintains page order", async () => {
    const repos = inMemoryRepos()
    const story = await repos.stories.create({
      userId: "user",
      title: "Title",
      script: "Script",
    })
    const first = await repos.pages.create({
      storyId: story.id,
      kind: "PAGE",
      position: 0,
      text: "First",
      imagePrompt: "",
      characterIds: [],
    })
    const second = await repos.pages.create({
      storyId: story.id,
      kind: "PAGE",
      position: 1,
      text: "Second",
      imagePrompt: "",
      characterIds: [],
    })

    await expect(
      repos.pages.updateOrder(story.id, [second.id, first.id])
    ).resolves.toMatchObject([
      { id: second.id, position: 0 },
      { id: first.id, position: 1 },
    ])
    await expect(repos.stories.getById(story.id)).resolves.toMatchObject({
      title: "Title",
    })
  })

  it("cascades a story deletion in the fake", async () => {
    const repos = inMemoryRepos()
    const story = await repos.stories.create({
      userId: "user",
      title: "Title",
      script: "Script",
    })
    await repos.characters.create({ storyId: story.id, name: "Sam" })
    await repos.stories.delete(story.id)
    await expect(repos.characters.listByStory(story.id)).resolves.toEqual([])
  })
})
