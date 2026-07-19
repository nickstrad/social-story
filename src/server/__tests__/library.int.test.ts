// @vitest-environment node

import { describe, expect, it } from "vitest"

import { createTestCaller } from "@/server/api/test-utils"
import { createFakeAiActions } from "@/server/ai/testing/fakes"
import type { Deps } from "@/server/container"
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

const makeDeps = (): Deps => ({
  repos: inMemoryRepos(),
  storage: inMemoryStorage(),
  ai: createFakeAiActions(),
  dispatcher: immediateDispatcher(async () => {}),
})

async function addLibraryPhoto(
  deps: Deps,
  libraryCharacterId: string,
  bytes = Buffer.from("library-photo")
) {
  const blob = await deps.storage.put(
    `users/${user.id}/library/photos/${libraryCharacterId}.png`,
    bytes,
    "image/png"
  )
  const asset = await deps.repos.assets.create({
    userId: user.id,
    storyId: null,
    kind: "LIBRARY_PHOTO",
    storageLocator: blob.locator,
    contentType: "image/png",
    byteLength: bytes.byteLength,
  })
  await deps.repos.libraryCharacters.update(libraryCharacterId, {
    photoAssetId: asset.id,
  })
  return asset
}

describe("character library integration", () => {
  it("CRUDs only the session user's library characters", async () => {
    const deps = makeDeps()
    const caller = createTestCaller({ user, deps })
    const created = await caller.library.characters.create({
      character: {
        name: "Sam",
        role: "Sibling",
        appearance: "Curly hair",
      },
    })
    expect((await caller.library.characters.list()).items).toEqual([created])

    const updated = await caller.library.characters.update({
      libraryCharacterId: created.id,
      character: { name: "Samuel", role: "Sibling" },
    })
    expect(updated.name).toBe("Samuel")

    const otherCaller = createTestCaller({ user: other, deps })
    await expect(
      otherCaller.library.characters.update({
        libraryCharacterId: created.id,
        character: { name: "Taken" },
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(
      otherCaller.library.characters.delete({
        libraryCharacterId: created.id,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
    expect(
      await deps.repos.libraryCharacters.getOwnedById(created.id, other.id)
    ).toBeNull()

    await caller.library.characters.delete({
      libraryCharacterId: created.id,
    })
    expect((await caller.library.characters.list()).items).toEqual([])
  })

  it("copies library fields and photo into a distinct story asset", async () => {
    const deps = makeDeps()
    const caller = createTestCaller({ user, deps })
    const story = await deps.repos.stories.create({
      userId: user.id,
      title: "Dentist",
      script: "A visit",
    })
    const saved = await caller.library.characters.create({
      character: {
        name: "Sam",
        role: "Child",
        age: "8",
        appearance: "Short dark hair",
        photoDescription: "Smiling in a blue shirt",
      },
    })
    const libraryPhoto = await addLibraryPhoto(deps, saved.id)

    const [created] = await caller.character.addFromLibrary({
      storyId: story.id,
      libraryCharacterIds: [saved.id],
    })
    expect(created).toMatchObject({
      name: "Sam",
      role: "Child",
      age: "8",
      appearance: "Short dark hair",
      photoDescription: "Smiling in a blue shirt",
      libraryCharacterId: saved.id,
    })
    expect(created.photoAssetId).not.toBe(libraryPhoto.id)
    const copied = await deps.repos.assets.getById(created.photoAssetId!)
    expect(copied).toMatchObject({
      storyId: story.id,
      kind: "CHARACTER_PHOTO",
    })
    expect(copied?.storageLocator).not.toBe(libraryPhoto.storageLocator)
    expect(await deps.storage.fetchBuffer(copied!.storageLocator)).toEqual(
      await deps.storage.fetchBuffer(libraryPhoto.storageLocator)
    )
  })

  it("validates every library id before creating any batch characters", async () => {
    const deps = makeDeps()
    const caller = createTestCaller({ user, deps })
    const otherCaller = createTestCaller({ user: other, deps })
    const story = await deps.repos.stories.create({
      userId: user.id,
      title: "Owner story",
      script: "Script",
    })
    const owned = await caller.library.characters.create({
      character: { name: "Owner character" },
    })
    const unowned = await otherCaller.library.characters.create({
      character: { name: "Other character" },
    })

    await expect(
      caller.character.addFromLibrary({
        storyId: story.id,
        libraryCharacterIds: [owned.id, unowned.id],
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
    expect(await deps.repos.characters.listByStory(story.id)).toEqual([])
  })

  it("saves a story character to the library once and copies its photo", async () => {
    const deps = makeDeps()
    const caller = createTestCaller({ user, deps })
    const story = await deps.repos.stories.create({
      userId: user.id,
      title: "Story",
      script: "Script",
    })
    const character = await deps.repos.characters.create({
      storyId: story.id,
      name: "Avery",
      appearance: "Red sweater",
    })
    const sourceBlob = await deps.storage.put(
      "stories/story/photo.png",
      Buffer.from("story-photo"),
      "image/png"
    )
    const sourceAsset = await deps.repos.assets.create({
      userId: user.id,
      storyId: story.id,
      kind: "CHARACTER_PHOTO",
      storageLocator: sourceBlob.locator,
      contentType: "image/png",
      byteLength: 11,
    })
    await deps.repos.characters.update(character.id, {
      photoAssetId: sourceAsset.id,
    })

    const saved = await caller.character.saveToLibrary({
      storyId: story.id,
      characterId: character.id,
    })
    expect(saved).toMatchObject({ name: "Avery", appearance: "Red sweater" })
    expect(saved.photoUrl).toBe(`/api/me/assets/${saved.photoAssetId}`)
    const savedPhoto = await deps.repos.assets.getById(saved.photoAssetId!)
    expect(savedPhoto).toMatchObject({ storyId: null, kind: "LIBRARY_PHOTO" })
    expect(savedPhoto?.id).not.toBe(sourceAsset.id)
    expect(
      (await deps.repos.characters.getById(character.id))?.libraryCharacterId
    ).toBe(saved.id)

    await expect(
      caller.character.saveToLibrary({
        storyId: story.id,
        characterId: character.id,
      })
    ).rejects.toMatchObject({ code: "CONFLICT" })
  })

  it("keeps copied story data when a library character is deleted, and vice versa", async () => {
    const deps = makeDeps()
    const caller = createTestCaller({ user, deps })
    const story = await deps.repos.stories.create({
      userId: user.id,
      title: "Story",
      script: "Script",
    })
    const saved = await caller.library.characters.create({
      character: { name: "Jordan" },
    })
    await addLibraryPhoto(deps, saved.id)
    const [copied] = await caller.character.addFromLibrary({
      storyId: story.id,
      libraryCharacterIds: [saved.id],
    })

    await caller.library.characters.delete({ libraryCharacterId: saved.id })
    expect(await deps.repos.characters.getById(copied.id)).toMatchObject({
      name: "Jordan",
      libraryCharacterId: null,
      photoAssetId: copied.photoAssetId,
    })
    expect(await deps.repos.assets.getById(copied.photoAssetId!)).not.toBeNull()

    const kept = await caller.library.characters.create({
      character: { name: "Kept" },
    })
    await caller.story.delete({ storyId: story.id })
    expect(
      await deps.repos.libraryCharacters.getOwnedById(kept.id, user.id)
    ).not.toBeNull()
  })

  it("reuses a source base image, replacing the target without changing the source", async () => {
    const deps = makeDeps()
    const caller = createTestCaller({ user, deps })
    const sourceStory = await deps.repos.stories.create({
      userId: user.id,
      title: "Source",
      script: "Script",
    })
    const targetStory = await deps.repos.stories.create({
      userId: user.id,
      title: "Target",
      script: "Script",
    })
    const sourceBlob = await deps.storage.put(
      "source/base.png",
      Buffer.from("source-base"),
      "image/png"
    )
    const sourceAsset = await deps.repos.assets.create({
      userId: user.id,
      storyId: sourceStory.id,
      kind: "BASE_IMAGE",
      storageLocator: sourceBlob.locator,
      contentType: "image/png",
      byteLength: 11,
    })
    await deps.repos.stories.update(sourceStory.id, {
      baseImageAssetId: sourceAsset.id,
    })
    const oldTargetBlob = await deps.storage.put(
      "target/old.png",
      Buffer.from("old"),
      "image/png"
    )
    const oldTargetAsset = await deps.repos.assets.create({
      userId: user.id,
      storyId: targetStory.id,
      kind: "BASE_IMAGE",
      storageLocator: oldTargetBlob.locator,
      contentType: "image/png",
      byteLength: 3,
    })
    await deps.repos.stories.update(targetStory.id, {
      baseImageAssetId: oldTargetAsset.id,
    })

    const reused = await caller.story.reuseBaseImage({
      storyId: targetStory.id,
      sourceStoryId: sourceStory.id,
    })
    expect(reused.assetId).not.toBe(sourceAsset.id)
    expect(await deps.repos.assets.getById(sourceAsset.id)).not.toBeNull()
    expect(await deps.repos.assets.getById(oldTargetAsset.id)).toBeNull()
    const copied = await deps.repos.assets.getById(reused.assetId)
    expect(await deps.storage.fetchBuffer(copied!.storageLocator)).toEqual(
      Buffer.from("source-base")
    )

    const noBase = await deps.repos.stories.create({
      userId: user.id,
      title: "No base",
      script: "Script",
    })
    await expect(
      caller.story.reuseBaseImage({
        storyId: targetStory.id,
        sourceStoryId: noBase.id,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })

    const otherStory = await deps.repos.stories.create({
      userId: other.id,
      title: "Other",
      script: "Script",
    })
    await expect(
      caller.story.reuseBaseImage({
        storyId: targetStory.id,
        sourceStoryId: otherStory.id,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})
