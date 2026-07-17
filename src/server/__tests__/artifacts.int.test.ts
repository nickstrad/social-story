// @vitest-environment node
import { describe, expect, it, vi } from "vitest"

import { createTestCaller } from "@/server/api/test-utils"
import { createFakeAiActions } from "@/server/ai/testing/fakes"
import type { Deps } from "@/server/container"
import type { AssetKind, Story } from "@/server/domain/types"
import { inMemoryRepos } from "@/server/repos/memory"
import { immediateDispatcher } from "@/server/services/fakes"
import { inMemoryStorage } from "@/server/services/memory-storage"

const user = {
  id: "owner",
  name: "Owner",
  email: "owner@example.com",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
}
const other = { ...user, id: "other", email: "other@example.com" }

const deps = (): Deps => ({
  repos: inMemoryRepos(),
  storage: inMemoryStorage(),
  ai: createFakeAiActions(),
  dispatcher: immediateDispatcher(async () => {}),
})

async function addAsset(
  services: Deps,
  story: Story,
  kind: AssetKind,
  name: string
) {
  return services.repos.assets.create({
    userId: story.userId,
    storyId: story.id,
    kind,
    storageLocator: `private/${name}`,
    contentType: kind === "PDF" ? "application/pdf" : "image/png",
    byteLength: 10,
    filename: kind === "PDF" ? `${story.title}.pdf` : undefined,
  })
}

describe("artifact router", () => {
  it("joins owned asset IDs, filters raw/unselected/cross-user data, and hides locators", async () => {
    const services = deps()
    const caller = createTestCaller({ user, deps: services })
    const story = await services.repos.stories.create({
      userId: user.id,
      title: "Trip",
      script: "A trip",
    })
    const base = await addAsset(services, story, "BASE_IMAGE", "base-secret")
    await services.repos.stories.update(story.id, {
      baseImageAssetId: base.id,
    })
    const photo = await addAsset(
      services,
      story,
      "CHARACTER_PHOTO",
      "photo-secret"
    )
    await services.repos.characters.create({
      storyId: story.id,
      name: "Nick",
      photoAssetId: photo.id,
    })
    const [page] = await services.repos.pages.replaceAll(story.id, [
      {
        kind: "PAGE",
        position: 0,
        text: "Page one",
        imagePrompt: "prompt",
        characterIds: [],
      },
    ])
    const selected = await addAsset(
      services,
      story,
      "PAGE_IMAGE",
      "selected-secret"
    )
    const raw = await addAsset(services, story, "PAGE_IMAGE_RAW", "raw-secret")
    const selectedImage = await services.repos.pages.addImage({
      pageId: page.id,
      imageAssetId: selected.id,
      rawAssetId: raw.id,
      promptUsed: "prompt",
      variant: 1,
    })
    await services.repos.pages.update(page.id, {
      selectedImageId: selectedImage.id,
    })
    const unselected = await addAsset(
      services,
      story,
      "PAGE_IMAGE",
      "unselected-secret"
    )
    await services.repos.pages.addImage({
      pageId: page.id,
      imageAssetId: unselected.id,
      promptUsed: "prompt",
      variant: 2,
    })
    const pdf = await addAsset(services, story, "PDF", "pdf-secret")
    await services.repos.tasks.create({
      userId: user.id,
      storyId: story.id,
      type: "PDF_EXPORT",
      status: "SUCCEEDED",
      resultJson: { assetId: pdf.id, pageCount: 1 },
    })

    const secret = await services.repos.stories.create({
      userId: other.id,
      title: "Secret",
      script: "hidden",
    })
    const otherAsset = await addAsset(
      services,
      secret,
      "BASE_IMAGE",
      "other-secret"
    )
    await services.repos.stories.update(secret.id, {
      baseImageAssetId: otherAsset.id,
    })

    const artifacts = await caller.artifact.list()
    expect(artifacts.map((artifact) => artifact.id).sort()).toEqual(
      [base.id, photo.id, selected.id, pdf.id].sort()
    )
    expect(
      artifacts.every(
        (artifact) => artifact.url === `/api/me/assets/${artifact.id}`
      )
    ).toBe(true)
    const payload = JSON.stringify(artifacts)
    expect(payload).not.toContain("private/")
    expect(payload).not.toContain(raw.id)
    expect(payload).not.toContain(unselected.id)
    expect(payload).not.toContain(otherAsset.id)
  })

  it("orders assets newest-first", async () => {
    vi.useFakeTimers()
    try {
      const services = deps()
      const caller = createTestCaller({ user, deps: services })
      const story = await services.repos.stories.create({
        userId: user.id,
        title: "Clock",
        script: "Tick",
      })
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
      const first = await addAsset(services, story, "CHARACTER_PHOTO", "first")
      await services.repos.characters.create({
        storyId: story.id,
        name: "First",
        photoAssetId: first.id,
      })
      vi.setSystemTime(new Date("2026-01-02T00:00:00Z"))
      const second = await addAsset(services, story, "BASE_IMAGE", "second")
      await services.repos.stories.update(story.id, {
        baseImageAssetId: second.id,
      })
      expect((await caller.artifact.list()).map((item) => item.id)).toEqual([
        second.id,
        first.id,
      ])
    } finally {
      vi.useRealTimers()
    }
  })

  it("ignores malformed task asset references", async () => {
    const services = deps()
    const caller = createTestCaller({ user, deps: services })
    const story = await services.repos.stories.create({
      userId: user.id,
      title: "Trip",
      script: "A trip",
    })
    await services.repos.tasks.create({
      userId: user.id,
      storyId: story.id,
      type: "PDF_EXPORT",
      status: "SUCCEEDED",
      resultJson: { assetId: "missing" },
    })
    expect(await caller.artifact.list()).toEqual([])
  })

  it("returns a cumulative story snapshot without exposing another user's story", async () => {
    const services = deps()
    const caller = createTestCaller({ user, deps: services })
    const story = await services.repos.stories.create({
      userId: user.id,
      title: "Snapshot",
      script: "First the story begins.",
    })
    await services.repos.characters.create({
      storyId: story.id,
      name: "Sam",
      appearance: "Short dark hair",
    })
    await services.repos.pages.replaceAll(story.id, [
      {
        kind: "PAGE",
        position: 1,
        text: "Sam gets ready.",
        imagePrompt: "Sam by the door",
        characterIds: [],
      },
    ])

    const snapshot = await caller.artifact.forStory({ storyId: story.id })
    expect(snapshot.story.script).toBe("First the story begins.")
    expect(snapshot.characters[0]?.name).toBe("Sam")
    expect(snapshot.pages[0]).toMatchObject({
      text: "Sam gets ready.",
      selectedImageUrl: null,
    })

    const otherCaller = createTestCaller({ user: other, deps: services })
    await expect(
      otherCaller.artifact.forStory({ storyId: story.id })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})
