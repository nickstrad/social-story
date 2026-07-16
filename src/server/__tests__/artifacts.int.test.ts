// @vitest-environment node
import { describe, expect, it } from "vitest"
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
// Postgres and no external APIs.

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
  text: fakeTextGenerator({}),
  image: fakeImageGenerator(),
  dispatcher: immediateDispatcher(async () => {}),
})

async function addSelectedPageImage(
  services: Deps,
  storyId: string,
  url: string
) {
  const [page] = await services.repos.pages.replaceAll(storyId, [
    {
      kind: "PAGE",
      position: 0,
      text: "Page one",
      imagePrompt: "a prompt",
      characterIds: [],
    },
  ])
  const image = await services.repos.pages.addImage({
    pageId: page.id,
    url,
    promptUsed: "a prompt",
    variant: 0,
  })
  await services.repos.pages.update(page.id, { selectedImageId: image.id })
  return page
}

describe("artifact router", () => {
  it("collects every blob kind for the owner and hides other users' work", async () => {
    const services = deps()
    const caller = createTestCaller({ user, deps: services })

    const story = await services.repos.stories.create({
      userId: user.id,
      title: "Trip",
      script: "A trip",
      baseImageUrl: "https://blob.test/base.png",
    })
    await services.repos.characters.create({
      storyId: story.id,
      name: "Nick",
      photoUrl: "https://blob.test/nick.jpg",
    })
    const page = await addSelectedPageImage(
      services,
      story.id,
      "https://blob.test/page-1.png"
    )
    // A second variant that was never selected must stay out of the feed.
    await services.repos.pages.addImage({
      pageId: page.id,
      url: "https://blob.test/page-1-alt.png",
      promptUsed: "a prompt",
      variant: 1,
    })
    await services.repos.tasks.create({
      userId: user.id,
      storyId: story.id,
      type: "PDF_EXPORT",
      status: "SUCCEEDED",
      resultJson: { url: "https://blob.test/trip.pdf" },
    })

    // Another user's story with its own base image stays invisible.
    await services.repos.stories.create({
      userId: other.id,
      title: "Secret",
      script: "hidden",
      baseImageUrl: "https://blob.test/secret.png",
    })

    const artifacts = await caller.artifact.list()

    expect(artifacts.map((artifact) => artifact.url).sort()).toEqual([
      "https://blob.test/base.png",
      "https://blob.test/nick.jpg",
      "https://blob.test/page-1.png",
      "https://blob.test/trip.pdf",
    ])
    expect(artifacts.every((artifact) => artifact.storyTitle === "Trip")).toBe(
      true
    )

    // Click-through routing is the UI's job (ArtifactGrid derives it from
    // `kind`), so this asserts the data, not a URL shape.
    const pdf = artifacts.find((artifact) => artifact.kind === "PDF")
    expect(pdf?.storyId).toBe(story.id)
    expect(pdf?.label).toBe("Trip.pdf")

    const pageImage = artifacts.find(
      (artifact) => artifact.kind === "PAGE_IMAGE"
    )
    expect(pageImage?.label).toBe("Page 1")
  })

  it("returns nothing for a story with no generated blobs", async () => {
    const services = deps()
    const caller = createTestCaller({ user, deps: services })
    await services.repos.stories.create({
      userId: user.id,
      title: "",
      script: "Just a draft",
    })
    expect(await caller.artifact.list()).toEqual([])
  })

  it("groups batched relations under the correct story", async () => {
    const services = deps()
    const caller = createTestCaller({ user, deps: services })
    const first = await services.repos.stories.create({
      userId: user.id,
      title: "First",
      script: "First story",
    })
    const second = await services.repos.stories.create({
      userId: user.id,
      title: "Second",
      script: "Second story",
    })

    await services.repos.characters.create({
      storyId: first.id,
      name: "First character",
      photoUrl: "https://blob.test/first-character.jpg",
    })
    await services.repos.tasks.create({
      userId: user.id,
      storyId: first.id,
      type: "PDF_EXPORT",
      status: "SUCCEEDED",
      resultJson: { url: "https://blob.test/first.pdf" },
    })

    await addSelectedPageImage(
      services,
      second.id,
      "https://blob.test/second-page.png"
    )

    const artifacts = await caller.artifact.list()
    expect(
      Object.fromEntries(
        artifacts.map((artifact) => [artifact.url, artifact.storyTitle])
      )
    ).toEqual({
      "https://blob.test/first-character.jpg": "First",
      "https://blob.test/first.pdf": "First",
      "https://blob.test/second-page.png": "Second",
    })
    expect(
      artifacts.find(
        (artifact) => artifact.url === "https://blob.test/second-page.png"
      )?.storyId
    ).toBe(second.id)
  })

  it("skips a failed or malformed PDF task rather than throwing", async () => {
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
      status: "FAILED",
      error: "boom",
    })
    await services.repos.tasks.create({
      userId: user.id,
      storyId: story.id,
      type: "PDF_EXPORT",
      status: "SUCCEEDED",
      resultJson: { notAUrl: 1 },
    })

    expect(await caller.artifact.list()).toEqual([])
  })
})
