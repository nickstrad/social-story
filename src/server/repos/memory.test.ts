import { describe, expect, it, vi } from "vitest"

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

  it("matches production list ordering and stable keyset boundaries", async () => {
    vi.useFakeTimers()
    try {
      const repos = inMemoryRepos()
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
      const alpha = await repos.stories.create({
        userId: "user",
        title: "Alpha",
        script: "Alpha",
      })
      const beta = await repos.stories.create({
        userId: "user",
        title: "Beta",
        script: "Beta",
      })
      vi.setSystemTime(new Date("2026-01-02T00:00:00Z"))
      const newest = await repos.stories.create({
        userId: "user",
        title: "Newest",
        script: "Newest",
      })

      expect(
        (await repos.stories.listByUser("user")).map((item) => item.id)
      ).toEqual([
        newest.id,
        [alpha.id, beta.id].sort().reverse()[0],
        [alpha.id, beta.id].sort().reverse()[1],
      ])

      const first = await repos.stories.listByUserPaged("user", "STORY", {
        limit: 1,
        sort: { field: "title", dir: "asc" },
      })
      await repos.stories.delete(first.items[0]!.id)
      const rest = await repos.stories.listByUserPaged("user", "STORY", {
        limit: 10,
        cursor: first.nextCursor,
        sort: { field: "title", dir: "asc" },
      })
      expect(rest.items.map((item) => item.title)).toEqual(["Beta", "Newest"])
      expect(rest.nextCursor).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})
