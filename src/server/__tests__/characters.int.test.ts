// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import type { Deps } from "@/server/container"
import { createTestCaller } from "@/server/api/test-utils"
import { db } from "@/server/db"
import { prismaRepos } from "@/server/repos/prisma"
import { fakeImageGenerator, fakeTextGenerator } from "@/server/services/fakes"
import { inMemoryStorage } from "@/server/services/memory-storage"

const suffix = crypto.randomUUID()
const user = {
  id: `owner-${suffix}`,
  name: "Owner",
  email: `owner-${suffix}@example.com`,
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  image: null,
}
const other = {
  ...user,
  id: `other-${suffix}`,
  email: `other-${suffix}@example.com`,
}
const deps = (): Deps => ({
  repos: prismaRepos(db),
  storage: inMemoryStorage(),
  text: fakeTextGenerator({}),
  image: fakeImageGenerator(),
})

describe("character and rule routers", () => {
  beforeAll(async () => {
    await db.user.createMany({ data: [user, other] })
  })
  afterAll(async () => {
    await db.user.deleteMany({ where: { id: { in: [user.id, other.id] } } })
    await db.$disconnect()
  })

  it("CRUDs records, cleans rules and blobs, and hides other users' stories", async () => {
    const services = deps()
    const deleteBlob = vi.spyOn(services.storage, "delete")
    const caller = createTestCaller({ user, deps: services })
    const story = await services.repos.stories.create({
      userId: user.id,
      title: "Trip",
      script: "A trip",
    })
    const first = await caller.character.create({
      storyId: story.id,
      character: { name: "Allison" },
    })
    const second = await caller.character.create({
      storyId: story.id,
      character: { name: "Ezra" },
    })
    const blob = await services.storage.put(
      "photo",
      Buffer.from("photo"),
      "image/png"
    )
    await services.repos.characters.update(first.id, { photoUrl: blob.url })
    const rule = await caller.rule.create({
      storyId: story.id,
      rule: {
        kind: "TOGETHER",
        text: "Together",
        characterIds: [first.id, second.id],
      },
    })
    expect(
      await caller.character.listForStory({ storyId: story.id })
    ).toHaveLength(2)
    await caller.rule.update({
      storyId: story.id,
      ruleId: rule.id,
      rule: {
        kind: "TOGETHER",
        text: "Always together",
        characterIds: [first.id, second.id],
      },
    })
    await caller.character.delete({ storyId: story.id, characterId: first.id })
    expect(deleteBlob).toHaveBeenCalledWith(blob.url)
    expect(
      (await caller.rule.listForStory({ storyId: story.id }))[0].characterIds
    ).toEqual([second.id])
    await caller.rule.delete({ storyId: story.id, ruleId: rule.id })
    await expect(
      createTestCaller({ user: other, deps: services }).character.listForStory({
        storyId: story.id,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})
