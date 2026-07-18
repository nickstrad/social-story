// @vitest-environment node

import sharp from "sharp"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Deps } from "@/server/container"
import { inMemoryRepos } from "@/server/repos/memory"

const mocks = vi.hoisted(() => ({
  getDeps: vi.fn(),
  getServerSession: vi.fn(),
  headers: vi.fn(),
}))

vi.mock("@/server/container", () => ({ getDeps: mocks.getDeps }))
vi.mock("@/server/auth-session", () => ({
  getServerSession: mocks.getServerSession,
}))
vi.mock("next/headers", () => ({ headers: mocks.headers }))

import { POST } from "./route"

async function photoFile(type = "image/jpeg") {
  const bytes = await sharp({
    create: {
      width: 4,
      height: 4,
      channels: 3,
      background: { r: 10, g: 20, b: 30 },
    },
  })
    .jpeg()
    .toBuffer()
  return new File([new Uint8Array(bytes)], "photo.jpg", { type })
}

async function request(storyId: string, file: File) {
  const form = new FormData()
  form.set("storyId", storyId)
  form.set("file", file)
  return new Request("http://localhost/api/describe/photo", {
    method: "POST",
    body: form,
  })
}

async function libraryRequest(file: File) {
  const form = new FormData()
  form.set("file", file)
  return new Request("http://localhost/api/describe/photo", {
    method: "POST",
    body: form,
  })
}

describe("POST /api/describe/photo", () => {
  const suggest = vi.fn()
  const repos = inMemoryRepos()
  let storyId: string

  beforeEach(async () => {
    vi.clearAllMocks()
    const story = await repos.stories.create({
      userId: "owner",
      title: "Story",
      script: "A sufficiently long story script for the test fixture.",
    })
    storyId = story.id
    mocks.headers.mockResolvedValue(new Headers())
    mocks.getServerSession.mockResolvedValue({ user: { id: "owner" } })
    mocks.getDeps.mockReturnValue({
      repos,
      ai: { characterPhotoAutofill: { suggest } },
    } as unknown as Deps)
    suggest.mockResolvedValue({
      appearance: "Short dark hair",
      photoDescription: "Smiling outdoors in a blue shirt.",
    })
  })

  it("checks ownership, normalizes to PNG, and invokes the semantic action", async () => {
    const response = await POST(await request(storyId, await photoFile()))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      appearance: "Short dark hair",
      photoDescription: "Smiling outdoors in a blue shirt.",
    })
    expect(suggest).toHaveBeenCalledOnce()
    const photo = suggest.mock.calls[0][0].photo
    expect(photo.mediaType).toBe("image/png")
    expect(photo.data.subarray(1, 4).toString()).toBe("PNG")
  })

  it("allows authenticated library autofill without a story", async () => {
    const response = await POST(await libraryRequest(await photoFile()))

    expect(response.status).toBe(200)
    expect(suggest).toHaveBeenCalledOnce()
  })

  it("rejects unauthenticated, unowned, and invalid uploads before AI", async () => {
    mocks.getServerSession.mockResolvedValueOnce(null)
    expect((await POST(await request(storyId, await photoFile()))).status).toBe(
      401
    )

    mocks.getServerSession.mockResolvedValueOnce({ user: { id: "other" } })
    expect((await POST(await request(storyId, await photoFile()))).status).toBe(
      404
    )

    expect(
      (
        await POST(
          await request(
            storyId,
            new File(["not an image"], "photo.txt", { type: "text/plain" })
          )
        )
      ).status
    ).toBe(400)
    expect(suggest).not.toHaveBeenCalled()
  })

  it("maps action failures to provider-neutral safe copy", async () => {
    suggest.mockRejectedValueOnce(
      new Error("OpenAI endpoint and private provider response")
    )

    const response = await POST(await request(storyId, await photoFile()))
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({
      error: "Could not auto-fill from this photo. Please try again.",
    })
  })
})
