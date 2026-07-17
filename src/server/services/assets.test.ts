import { describe, expect, it, vi } from "vitest"

import type { Deps } from "@/server/container"
import { inMemoryRepos } from "@/server/repos/memory"
import {
  fakeImageGenerator,
  fakeTextGenerator,
  immediateDispatcher,
} from "./fakes"
import { inMemoryStorage } from "./memory-storage"
import { BROWSER_ASSET_KINDS, replaceCharacterPhotoAsset } from "./assets"

const makeDeps = (): Deps => ({
  repos: inMemoryRepos(),
  storage: inMemoryStorage(),
  text: fakeTextGenerator({}),
  image: fakeImageGenerator(),
  dispatcher: immediateDispatcher(async () => {}),
})

describe("asset registry and lifecycle", () => {
  it("enforces the compound story owner invariant", async () => {
    const deps = makeDeps()
    const story = await deps.repos.stories.create({
      userId: "owner",
      title: "Story",
      script: "Script",
    })
    await expect(
      deps.repos.assets.create({
        userId: "other",
        storyId: story.id,
        kind: "BASE_IMAGE",
        storageLocator: "private/base",
        contentType: "image/png",
        byteLength: 1,
      })
    ).rejects.toThrow(/owner must match/i)
  })

  it("scopes lookup by owner and rejects raw browser reads as not found", async () => {
    const deps = makeDeps()
    const story = await deps.repos.stories.create({
      userId: "owner",
      title: "Story",
      script: "Script",
    })
    const raw = await deps.repos.assets.create({
      userId: "owner",
      storyId: story.id,
      kind: "PAGE_IMAGE_RAW",
      storageLocator: "private/raw",
      contentType: "image/png",
      byteLength: 1,
    })
    expect(
      await deps.repos.assets.getOwnedById(raw.id, "other", BROWSER_ASSET_KINDS)
    ).toBeNull()
    expect(
      await deps.repos.assets.getOwnedById(raw.id, "owner", BROWSER_ASSET_KINDS)
    ).toBeNull()
  })

  it("atomically swaps a photo registry row and best-effort deletes the old blob", async () => {
    const deps = makeDeps()
    const story = await deps.repos.stories.create({
      userId: "owner",
      title: "Story",
      script: "Script",
    })
    const character = await deps.repos.characters.create({
      storyId: story.id,
      name: "Ava",
    })
    const first = await replaceCharacterPhotoAsset(
      deps,
      story,
      character,
      Buffer.from("first"),
      "first.png"
    )
    const deleteBlob = vi.spyOn(deps.storage, "delete")
    const current = (await deps.repos.characters.getById(character.id))!
    const second = await replaceCharacterPhotoAsset(
      deps,
      story,
      current,
      Buffer.from("second"),
      "second.png"
    )
    expect(
      (await deps.repos.characters.getById(character.id))?.photoAssetId
    ).toBe(second.id)
    expect(await deps.repos.assets.getById(first.id)).toBeNull()
    expect(deleteBlob).toHaveBeenCalledWith(first.storageLocator)
  })
})
