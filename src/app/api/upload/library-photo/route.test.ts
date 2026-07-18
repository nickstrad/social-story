// @vitest-environment node

import sharp from "sharp"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Deps } from "@/server/container"
import { createFakeAiActions } from "@/server/ai/testing/fakes"
import { inMemoryRepos } from "@/server/repos/memory"
import { immediateDispatcher } from "@/server/services/fakes"
import { inMemoryStorage } from "@/server/services/memory-storage"

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

async function photoFile() {
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
  return new File([new Uint8Array(bytes)], "photo.jpg", {
    type: "image/jpeg",
  })
}

async function request(libraryCharacterId: string) {
  const form = new FormData()
  form.set("libraryCharacterId", libraryCharacterId)
  form.set("file", await photoFile())
  return new Request("http://localhost/api/upload/library-photo", {
    method: "POST",
    body: form,
  })
}

describe("POST /api/upload/library-photo", () => {
  let deps: Deps
  let libraryCharacterId: string

  beforeEach(async () => {
    vi.clearAllMocks()
    deps = {
      repos: inMemoryRepos(),
      storage: inMemoryStorage(),
      ai: createFakeAiActions(),
      dispatcher: immediateDispatcher(async () => {}),
    }
    libraryCharacterId = (
      await deps.repos.libraryCharacters.create({
        userId: "owner",
        name: "Sam",
      })
    ).id
    mocks.headers.mockResolvedValue(new Headers())
    mocks.getServerSession.mockResolvedValue({ user: { id: "owner" } })
    mocks.getDeps.mockReturnValue(deps)
  })

  it("stores an owned library photo as a user-scoped asset", async () => {
    const response = await POST(await request(libraryCharacterId))
    expect(response.status).toBe(200)

    const character = await deps.repos.libraryCharacters.getOwnedById(
      libraryCharacterId,
      "owner"
    )
    const asset = await deps.repos.assets.getById(character!.photoAssetId!)
    expect(asset).toMatchObject({
      userId: "owner",
      storyId: null,
      kind: "LIBRARY_PHOTO",
    })
  })

  it("rejects another user's library character", async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: "other" } })
    const response = await POST(await request(libraryCharacterId))
    expect(response.status).toBe(404)
    expect(
      (
        await deps.repos.libraryCharacters.getOwnedById(
          libraryCharacterId,
          "owner"
        )
      )?.photoAssetId
    ).toBeNull()
  })
})
