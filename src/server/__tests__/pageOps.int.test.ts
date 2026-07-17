// @vitest-environment node

import { beforeEach, describe, expect, it } from "vitest"

import { createTestCaller } from "@/server/api/test-utils"
import { createFakeAiActions } from "@/server/ai/testing/fakes"
import type { Deps } from "@/server/container"
import { immediateDispatcher } from "@/server/services/fakes"
import { inMemoryRepos } from "@/server/repos/memory"
import { inMemoryStorage } from "@/server/services/memory-storage"

// Self-sufficient integration test: in-memory repos + fake adapters, no real
// Postgres and no external APIs. Real-DB coverage lives in the Playwright E2E
// suite (docs/plans/completed/13-e2e-playwright.md).

const userId = "pageops-user"

const user = {
  id: userId,
  name: "Page Ops",
  email: "pageops@example.com",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
}

describe("page ops through the router", () => {
  let deps: Deps
  // The seeded story's generated id (in-memory repos assign their own ids).
  let storyIdRef: string
  const caller = () => createTestCaller({ user, deps })

  beforeEach(async () => {
    deps = {
      repos: inMemoryRepos(),
      storage: inMemoryStorage(),
      ai: createFakeAiActions(),
      dispatcher: immediateDispatcher(async () => {}),
    }
    const story = await deps.repos.stories.create({
      userId,
      title: "Story",
      script: "Script",
    })
    storyIdRef = story.id
    // Seed a cover plus two content pages, contiguous from 0.
    await deps.repos.pages.create({
      storyId: story.id,
      kind: "COVER",
      position: 0,
      text: "Cover",
      imagePrompt: "Cover",
      characterIds: [],
    })
    for (let i = 1; i <= 2; i++) {
      await deps.repos.pages.create({
        storyId: story.id,
        kind: "PAGE",
        position: i,
        text: `Page ${i}`,
        imagePrompt: `Page ${i}`,
        characterIds: [],
      })
    }
  })

  it("adds a page after an anchor, keeping positions contiguous and the cover pinned", async () => {
    const before = await deps.repos.pages.listByStory(storyIdRef)
    const anchor = before.find((p) => p.kind === "PAGE")!
    const created = await caller().page.add({
      storyId: storyIdRef,
      afterPageId: anchor.id,
    })

    const after = await deps.repos.pages.listByStory(storyIdRef)
    expect(after.map((p) => p.position)).toEqual([0, 1, 2, 3])
    expect(after[0].kind).toBe("COVER")
    expect(after.find((p) => p.id === created.id)?.position).toBe(2)
  })

  it("rejects an unknown afterPageId", async () => {
    await expect(
      caller().page.add({ storyId: storyIdRef, afterPageId: "nope" })
    ).rejects.toThrow(/afterPageId/i)
  })

  it("removes a page and renumbers the rest contiguously", async () => {
    const pages = await deps.repos.pages.listByStory(storyIdRef)
    const target = pages.find((p) => p.kind === "PAGE")!
    await caller().page.remove({ pageId: target.id })

    const after = await deps.repos.pages.listByStory(storyIdRef)
    expect(after.map((p) => p.position)).toEqual([0, 1])
    expect(after.some((p) => p.id === target.id)).toBe(false)
    expect(after[0].kind).toBe("COVER")
  })

  it("refuses to remove the cover", async () => {
    const pages = await deps.repos.pages.listByStory(storyIdRef)
    const cover = pages.find((p) => p.kind === "COVER")!
    await expect(caller().page.remove({ pageId: cover.id })).rejects.toThrow(
      /cover/i
    )
  })

  it("hides and unhides a page", async () => {
    const pages = await deps.repos.pages.listByStory(storyIdRef)
    const target = pages.find((p) => p.kind === "PAGE")!
    await caller().page.setHidden({ pageId: target.id, hidden: true })
    expect((await deps.repos.pages.getById(target.id))?.hidden).toBe(true)
    await caller().page.setHidden({ pageId: target.id, hidden: false })
    expect((await deps.repos.pages.getById(target.id))?.hidden).toBe(false)
  })

  it("reorders content while pinning the cover at position 0", async () => {
    const pages = await deps.repos.pages.listByStory(storyIdRef)
    const cover = pages.find((p) => p.kind === "COVER")!
    const content = pages.filter((p) => p.kind === "PAGE")
    // Request content reversed, and mischievously put the cover last.
    await caller().page.reorder({
      storyId: storyIdRef,
      orderedPageIds: [content[1].id, content[0].id, cover.id],
    })

    const after = await deps.repos.pages.listByStory(storyIdRef)
    expect(after.map((p) => p.id)).toEqual([
      cover.id,
      content[1].id,
      content[0].id,
    ])
    expect(after.map((p) => p.position)).toEqual([0, 1, 2])
  })

  it("returns rule-expanded characterIds from page.update but persists the raw selection", async () => {
    const ava = await deps.repos.characters.create({
      storyId: storyIdRef,
      name: "Ava",
    })
    const bo = await deps.repos.characters.create({
      storyId: storyIdRef,
      name: "Bo",
    })
    await deps.repos.rules.create({
      storyId: storyIdRef,
      text: "Ava and Bo appear together",
      kind: "TOGETHER",
      characterIds: [ava.id, bo.id],
    })
    const pages = await deps.repos.pages.listByStory(storyIdRef)
    const target = pages.find((p) => p.kind === "PAGE")!

    const updated = await caller().page.update({
      pageId: target.id,
      characterIds: [ava.id],
    })
    // TOGETHER pulls Bo into the returned effective cast...
    expect(new Set(updated.characterIds)).toEqual(new Set([ava.id, bo.id]))
    // ...but only the author's raw selection is persisted.
    expect((await deps.repos.pages.getById(target.id))?.characterIds).toEqual([
      ava.id,
    ])
  })
})
