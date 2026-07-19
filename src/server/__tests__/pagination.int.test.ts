// @vitest-environment node

import { describe, expect, it, vi } from "vitest"

import { createFakeAiActions } from "@/server/ai/testing/fakes"
import { createTestCaller } from "@/server/api/test-utils"
import type { Deps } from "@/server/container"
import { inMemoryRepos } from "@/server/repos/memory"
import { immediateDispatcher } from "@/server/services/fakes"
import { inMemoryStorage } from "@/server/services/memory-storage"
import { encodeCursor } from "@/lib/validation/listParams"

const user = {
  id: "owner",
  name: "Owner",
  email: "owner@example.com",
  emailVerified: true,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const makeDeps = (): Deps => ({
  repos: inMemoryRepos(),
  storage: inMemoryStorage(),
  ai: createFakeAiActions(),
  dispatcher: immediateDispatcher(async () => {}),
})

describe("paged collection procedures", () => {
  it("walks stories in server sort order without duplicates or gaps", async () => {
    const deps = makeDeps()
    const caller = createTestCaller({ user, deps })
    for (const title of ["Delta", "Alpha", "Echo", "Bravo", "Charlie"]) {
      await deps.repos.stories.create({
        userId: user.id,
        title,
        script: title,
      })
    }

    const seen: string[] = []
    let cursor: string | null | undefined
    do {
      const page = await caller.story.list({
        limit: 2,
        cursor,
        sort: { field: "title", dir: "asc" },
      })
      seen.push(...page.items.map((story) => story.title))
      cursor = page.nextCursor
    } while (cursor)

    expect(seen).toEqual(["Alpha", "Bravo", "Charlie", "Delta", "Echo"])
    expect(new Set(seen).size).toBe(5)
    await expect(caller.story.list({ limit: 101 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    })
  })

  it("rejects a forged date cursor as bad input", async () => {
    const caller = createTestCaller({ user, deps: makeDeps() })
    await expect(
      caller.story.list({
        cursor: encodeCursor("not-a-date", "forged"),
        sort: { field: "createdAt", dir: "desc" },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
    await expect(
      caller.library.characters.list({
        cursor: encodeCursor("not-a-date", "forged"),
        sort: { field: "createdAt", dir: "desc" },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("paginates templates and computes counts only for returned rows", async () => {
    const deps = makeDeps()
    const caller = createTestCaller({ user, deps })
    for (const title of ["Beta", "Alpha"]) {
      const template = await deps.repos.stories.create({
        userId: user.id,
        title,
        script: title,
        kind: "TEMPLATE",
      })
      await deps.repos.characters.create({ storyId: template.id, name: title })
      await deps.repos.pages.create({
        storyId: template.id,
        kind: "PAGE",
        position: 0,
        text: title,
        imagePrompt: "",
        characterIds: [],
      })
    }

    const first = await caller.template.list({
      limit: 1,
      sort: { field: "title", dir: "asc" },
    })
    expect(first.items).toHaveLength(1)
    expect(first.items[0]).toMatchObject({
      title: "Alpha",
      counts: { characters: 1, pages: 1 },
    })
    expect(first.nextCursor).not.toBeNull()
    const second = await caller.template.list({
      limit: 1,
      cursor: first.nextCursor,
      sort: { field: "title", dir: "asc" },
    })
    expect(second.items.map((template) => template.title)).toEqual(["Beta"])
  })

  it("walks library characters through a tied sort value", async () => {
    const deps = makeDeps()
    const caller = createTestCaller({ user, deps })
    for (const name of ["Sam", "Alex", "Sam"]) {
      await deps.repos.libraryCharacters.create({ userId: user.id, name })
    }
    const first = await caller.library.characters.list({
      limit: 2,
      sort: { field: "name", dir: "asc" },
    })
    const second = await caller.library.characters.list({
      limit: 2,
      cursor: first.nextCursor,
      sort: { field: "name", dir: "asc" },
    })
    expect([...first.items, ...second.items].map((item) => item.name)).toEqual([
      "Alex",
      "Sam",
      "Sam",
    ])
  })

  it("paginates artifacts at story granularity", async () => {
    vi.useFakeTimers()
    try {
      const deps = makeDeps()
      const caller = createTestCaller({ user, deps })
      for (const [index, title] of ["First", "Second"].entries()) {
        vi.setSystemTime(new Date(`2026-01-0${index + 1}T00:00:00Z`))
        const story = await deps.repos.stories.create({
          userId: user.id,
          title,
          script: title,
        })
        const asset = await deps.repos.assets.create({
          userId: user.id,
          storyId: story.id,
          kind: "BASE_IMAGE",
          storageLocator: `${title}-base`,
          contentType: "image/png",
          byteLength: 1,
        })
        await deps.repos.stories.update(story.id, {
          baseImageAssetId: asset.id,
        })
      }

      const first = await caller.artifact.list({ limit: 1 })
      const second = await caller.artifact.list({
        limit: 1,
        cursor: first.nextCursor,
      })
      expect(first.items.map((item) => item.storyTitle)).toEqual(["Second"])
      expect(second.items.map((item) => item.storyTitle)).toEqual(["First"])
      expect(second.nextCursor).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})
