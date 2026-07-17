// @vitest-environment node

import { PDFDocument } from "pdf-lib"
import { describe, expect, it } from "vitest"

import { createTestCaller } from "@/server/api/test-utils"
import { createFakeAiActions, fakeArtwork } from "@/server/ai/testing/fakes"
import type { Deps } from "@/server/container"
import type { ParsedStory } from "@/server/domain/schemas"
import { getTaskHandler } from "@/server/inngest/handlers"
// Side-effect imports: register every task handler the flow dispatches.
import "@/server/inngest/functions/parseStory"
import "@/server/inngest/functions/baseImage"
import "@/server/inngest/functions/pageImage"
import "@/server/inngest/functions/pdfExport"
import { inMemoryRepos } from "@/server/repos/memory"
import { immediateDispatcher } from "@/server/services/fakes"
import { inMemoryStorage } from "@/server/services/memory-storage"
import { runTask } from "@/server/services/tasks"

const SCRIPT = "Ava and Bo spend the day together at the park."

const parsed: ParsedStory = {
  title: "Ava and Bo's Day",
  pages: [
    {
      page: 1,
      text: "Ava waves hello.",
      imagePrompt: "Ava waving in a park",
      characterNames: ["Ava"],
    },
    {
      page: 2,
      text: "Bo smiles back.",
      imagePrompt: "Bo smiling in a park",
      characterNames: ["Bo"],
    },
  ],
}

// The capstone merge test: the whole product flow through tRPC callers, the
// immediate task dispatcher, and in-memory fakes — no real DB or network.
describe("full story-to-PDF flow", () => {
  function makeDeps(): Deps {
    const repos = inMemoryRepos()
    const deps: Deps = {
      repos,
      storage: inMemoryStorage(),
      ai: createFakeAiActions({
        storyToData: async () => parsed,
        baseImage: async () => fakeArtwork("base image"),
        pageImage: async () => fakeArtwork("page image"),
        coverImage: async () => fakeArtwork("cover image"),
      }),
      dispatcher: immediateDispatcher(async (taskId) => {
        const task = await repos.tasks.getById(taskId)
        const handler = task && getTaskHandler(task.type)
        if (handler) await runTask(deps, taskId, handler)
      }),
    }
    return deps
  }

  it("parses, generates, hides a page, and exports a downloadable PDF", async () => {
    const deps = makeDeps()
    const now = new Date()
    // "Sign-up": a session user; in-memory repos don't enforce a user FK.
    const caller = createTestCaller({
      user: {
        id: "user-e2e",
        name: "E2E User",
        email: "e2e@example.com",
        emailVerified: true,
        image: null,
        createdAt: now,
        updatedAt: now,
      },
      deps,
    })

    // Empty title so the parse result names the story.
    const story = await caller.story.create({ script: SCRIPT })

    // Cast + a TOGETHER rule, seeded before parse so names resolve to ids.
    const ava = await deps.repos.characters.create({
      storyId: story.id,
      name: "Ava",
    })
    const bo = await deps.repos.characters.create({
      storyId: story.id,
      name: "Bo",
    })
    await deps.repos.rules.create({
      storyId: story.id,
      text: "Ava and Bo appear together",
      kind: "TOGETHER",
      characterIds: [ava.id, bo.id],
    })

    await caller.story.parse({ storyId: story.id })
    await caller.story.generateBaseImage({ storyId: story.id })

    const pages = await deps.repos.pages.listByStory(story.id)
    expect(pages).toHaveLength(3) // cover + 2 content pages

    // A mid-flow export before any images exist must FAIL with a readable list.
    const early = await caller.pdf.export({ storyId: story.id })
    const earlyTask = await deps.repos.tasks.getById(early.taskId)
    expect(earlyTask?.status).toBe("FAILED")
    expect(earlyTask?.error).toMatch(/no image/i)

    // Bulk-generate every page (cover included), then hide one content page.
    await caller.page.generateBulk({
      storyId: story.id,
      pageIds: pages.map((page) => page.id),
    })
    const contentPage = pages.find((page) => page.kind === "PAGE")!
    await caller.page.setHidden({ pageId: contentPage.id, hidden: true })

    const { taskId } = await caller.pdf.export({ storyId: story.id })
    const exportTask = await deps.repos.tasks.getById(taskId)
    expect(exportTask?.status).toBe("SUCCEEDED")

    const result = exportTask?.resultJson as {
      assetId: string
      pageCount: number
    }
    // Cover + 1 visible content page; the hidden page is excluded.
    expect(result.pageCount).toBe(2)

    const asset = await deps.repos.assets.getById(result.assetId)
    const pdf = await deps.storage.fetchBuffer(asset!.storageLocator)
    expect(pdf.subarray(0, 4).toString("latin1")).toBe("%PDF")
    const doc = await PDFDocument.load(pdf)
    expect(doc.getPageCount()).toBe(2)

    const refreshed = await deps.repos.stories.getById(story.id)
    expect(refreshed?.status).toBe("READY")
  })
})
