// @vitest-environment node

import { describe, expect, it } from "vitest"

import { createFakeAiActions } from "@/server/ai/testing/fakes"
import { createTestCaller } from "@/server/api/test-utils"
import type { Deps } from "@/server/container"
import { inMemoryRepos } from "@/server/repos/memory"
import { immediateDispatcher } from "@/server/services/fakes"
import { inMemoryStorage } from "@/server/services/memory-storage"

const user = {
  id: "owner",
  name: "Owner",
  email: "owner@example.com",
  emailVerified: true,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}
const other = { ...user, id: "other", email: "other@example.com" }
const makeDeps = (): Deps => ({
  repos: inMemoryRepos(),
  storage: inMemoryStorage(),
  ai: createFakeAiActions(),
  dispatcher: immediateDispatcher(async () => {}),
})

async function seedTemplate(deps: Deps) {
  const template = await deps.repos.stories.create({
    userId: user.id,
    title: "Sam visits",
    script: "Sam visits the clinic.",
    kind: "TEMPLATE",
    status: "PARSED",
  })
  const required = await deps.repos.characters.create({
    storyId: template.id,
    name: "Sam",
    appearance: "Placeholder appearance",
  })
  const optional = await deps.repos.characters.create({
    storyId: template.id,
    name: "Sibling",
    isOptional: true,
  })
  await deps.repos.rules.create({
    storyId: template.id,
    text: "Keep Sam nearby",
    kind: "ALWAYS_INCLUDE",
    characterIds: [required.id],
  })
  await deps.repos.pages.replaceAll(template.id, [
    {
      kind: "COVER",
      position: 0,
      text: "Sam visits",
      imagePrompt: "Sam outside the clinic",
      characterIds: [required.id, optional.id],
    },
  ])
  return { template, required, optional }
}

async function seedSavedCharacter(deps: Deps) {
  const blob = await deps.storage.put(
    "library-photo",
    Buffer.from("saved photo"),
    "image/png"
  )
  const sourcePhoto = await deps.repos.assets.create({
    userId: user.id,
    storyId: null,
    kind: "LIBRARY_PHOTO",
    storageLocator: blob.locator,
    contentType: "image/png",
    byteLength: 11,
  })
  const saved = await deps.repos.libraryCharacters.create({
    userId: user.id,
    name: "Riley",
    appearance: "Blue glasses",
    photoDescription: "Riley smiling",
    photoAssetId: sourcePhoto.id,
  })
  return { saved, sourcePhoto }
}

describe("template integration", () => {
  it("instantiates a parsed, renamed, asset-free story with valid character ids", async () => {
    const deps = makeDeps()
    const { template, required, optional } = await seedTemplate(deps)
    const caller = createTestCaller({ user, deps })
    const result = await caller.template.instantiate({
      templateId: template.id,
      title: "Riley visits",
      cast: [
        { templateCharacterId: required.id, name: "Riley", include: true },
        { templateCharacterId: optional.id, name: "", include: false },
      ],
    })

    const instance = await deps.repos.stories.getById(result.storyId)
    const characters = await deps.repos.characters.listByStory(result.storyId)
    const pages = await deps.repos.pages.listByStory(result.storyId)
    expect(instance).toMatchObject({
      userId: user.id,
      kind: "STORY",
      templateId: template.id,
      status: "PARSED",
      title: "Riley visits",
    })
    expect(characters).toHaveLength(1)
    expect(characters[0]).toMatchObject({
      name: "Riley",
      appearance: null,
      photoAssetId: null,
    })
    expect(pages[0].characterIds).toEqual([characters[0].id])
    expect(pages[0].text).toBe("Riley visits")
    expect(await deps.repos.assets.listByStory(result.storyId)).toEqual([])
  })

  it("fills a slot from the caller's saved character and copies its photo", async () => {
    const deps = makeDeps()
    const { template, required } = await seedTemplate(deps)
    const { saved, sourcePhoto } = await seedSavedCharacter(deps)

    const result = await createTestCaller({ user, deps }).template.instantiate({
      templateId: template.id,
      title: "Riley visits",
      cast: [
        {
          templateCharacterId: required.id,
          name: saved.name,
          include: true,
          libraryCharacterId: saved.id,
        },
      ],
    })

    const [character] = await deps.repos.characters.listByStory(result.storyId)
    expect(character).toMatchObject({
      name: "Riley",
      appearance: "Blue glasses",
      photoDescription: "Riley smiling",
      libraryCharacterId: saved.id,
    })
    expect(character.photoAssetId).not.toBe(sourcePhoto.id)
    expect(
      await deps.repos.assets.getById(character.photoAssetId!)
    ).toMatchObject({
      storyId: result.storyId,
      kind: "CHARACTER_PHOTO",
    })
  })

  it("rejects a missing saved-character photo before creating an instance", async () => {
    const deps = makeDeps()
    const { template, required } = await seedTemplate(deps)
    const saved = await deps.repos.libraryCharacters.create({
      userId: user.id,
      name: "Riley",
      photoAssetId: "missing-photo",
    })

    await expect(
      createTestCaller({ user, deps }).template.instantiate({
        templateId: template.id,
        title: "Riley visits",
        cast: [
          {
            templateCharacterId: required.id,
            name: saved.name,
            include: true,
            libraryCharacterId: saved.id,
          },
        ],
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
    expect(await deps.repos.stories.listByUser(user.id, "STORY")).toEqual([])
  })

  it("removes the instance if saved-character photo copying fails", async () => {
    const deps = makeDeps()
    const { template, required } = await seedTemplate(deps)
    const { saved } = await seedSavedCharacter(deps)
    deps.storage.put = async () => {
      throw new Error("storage unavailable")
    }

    await expect(
      createTestCaller({ user, deps }).template.instantiate({
        templateId: template.id,
        title: "Riley visits",
        cast: [
          {
            templateCharacterId: required.id,
            name: saved.name,
            include: true,
            libraryCharacterId: saved.id,
          },
        ],
      })
    ).rejects.toThrow("storage unavailable")
    expect(await deps.repos.stories.listByUser(user.id, "STORY")).toEqual([])
  })

  it("rejects an excluded required slot and cross-user use", async () => {
    const deps = makeDeps()
    const { template, required } = await seedTemplate(deps)
    const caller = createTestCaller({ user, deps })
    await expect(
      caller.template.instantiate({
        templateId: template.id,
        title: "No cast",
        cast: [
          { templateCharacterId: required.id, name: "Sam", include: false },
        ],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
    await expect(
      createTestCaller({ user: other, deps }).template.instantiate({
        templateId: template.id,
        title: "Stolen",
        cast: [
          { templateCharacterId: required.id, name: "Sam", include: true },
        ],
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("creates a photo-less template copy without changing the source story", async () => {
    const deps = makeDeps()
    const source = await deps.repos.stories.create({
      userId: user.id,
      title: "Source",
      script: "Sam goes inside.",
      status: "PARSED",
    })
    const character = await deps.repos.characters.create({
      storyId: source.id,
      name: "Sam",
      appearance: "Red sweater",
      photoDescription: "Source photo",
    })
    const blob = await deps.storage.put(
      "source-photo",
      Buffer.from("photo"),
      "image/png"
    )
    const photo = await deps.repos.assets.create({
      userId: user.id,
      storyId: source.id,
      kind: "CHARACTER_PHOTO",
      storageLocator: blob.locator,
      contentType: "image/png",
      byteLength: 5,
    })
    await deps.repos.characters.update(character.id, { photoAssetId: photo.id })
    await deps.repos.pages.replaceAll(source.id, [
      {
        kind: "PAGE",
        position: 0,
        text: "Sam goes inside.",
        imagePrompt: "Sam walks inside",
        characterIds: [character.id],
      },
    ])

    const result = await createTestCaller({
      user,
      deps,
    }).template.createFromStory({
      storyId: source.id,
      title: "Clinic visit",
    })
    const created = await deps.repos.stories.getById(result.storyId)
    const [createdCharacter] = await deps.repos.characters.listByStory(
      result.storyId
    )
    expect(await deps.repos.stories.getById(source.id)).toMatchObject({
      kind: "STORY",
      title: "Source",
    })
    expect(await deps.repos.characters.getById(character.id)).toMatchObject({
      photoAssetId: photo.id,
    })
    expect(created).toMatchObject({ kind: "TEMPLATE", templateId: null })
    expect(createdCharacter).toMatchObject({
      appearance: "Red sweater",
      photoDescription: null,
      photoAssetId: null,
    })
    expect(await deps.repos.assets.listByStory(result.storyId)).toEqual([])
  })

  it("nulls the source edge when a template is deleted", async () => {
    const deps = makeDeps()
    const { template, required } = await seedTemplate(deps)
    const caller = createTestCaller({ user, deps })
    const instance = await caller.template.instantiate({
      templateId: template.id,
      title: "Instance",
      cast: [{ templateCharacterId: required.id, name: "Sam", include: true }],
    })
    await caller.story.delete({ storyId: template.id })
    expect(await deps.repos.stories.getById(instance.storyId)).toMatchObject({
      templateId: null,
    })
  })
})
