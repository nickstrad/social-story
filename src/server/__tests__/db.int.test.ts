import { randomUUID } from "node:crypto"

import type { PrismaClient } from "@prisma/client"
import "dotenv/config"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import type { Repos } from "../ports/repos"

const runIntegration = Boolean(process.env.DATABASE_URL)

describe.skipIf(!runIntegration)("Prisma repositories", () => {
  let db: PrismaClient
  let repos: Repos
  const userId = `test-${randomUUID()}`

  beforeAll(async () => {
    const [{ db: database }, { prismaRepos }] = await Promise.all([
      import("../db"),
      import("../repos/prisma"),
    ])
    db = database
    repos = prismaRepos(db)
  })

  afterAll(async () => {
    await db.user.deleteMany({ where: { id: userId } })
    await db.$disconnect()
  })

  it("creates and reads nested story pages, then cascades deletion", async () => {
    await db.user.create({
      data: { id: userId, name: "Test User", email: `${userId}@example.com` },
    })
    const story = await repos.stories.create({
      userId,
      title: "Repository integration",
      script: "A short story",
    })
    await repos.pages.create({
      storyId: story.id,
      kind: "COVER",
      position: 0,
      text: "Cover",
      imagePrompt: "A cheerful cover",
      characterIds: [],
    })
    await repos.pages.create({
      storyId: story.id,
      kind: "PAGE",
      position: 1,
      text: "Page one",
      imagePrompt: "A cheerful page",
      characterIds: [],
    })

    await expect(repos.stories.getById(story.id)).resolves.toMatchObject({
      title: "Repository integration",
    })
    await expect(repos.pages.listByStory(story.id)).resolves.toHaveLength(2)

    await repos.stories.delete(story.id)
    await expect(repos.pages.listByStory(story.id)).resolves.toEqual([])
  })
})
