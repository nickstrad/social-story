import type { PrismaClient } from "@prisma/client"

import type { CharacterRepo } from "../../ports/repos"

const listCharactersByStoryIds = (db: PrismaClient, storyIds: string[]) =>
  db.character.findMany({
    where: { storyId: { in: storyIds } },
    orderBy: { createdAt: "asc" },
  })

export const prismaCharacterRepo = (db: PrismaClient): CharacterRepo => ({
  create: (data) => db.character.create({ data }),
  getById: (id) => db.character.findUnique({ where: { id } }),
  listByStory: (storyId) => listCharactersByStoryIds(db, [storyId]),
  listByStoryIds: (storyIds) => listCharactersByStoryIds(db, storyIds),
  update: (id, data) => db.character.update({ where: { id }, data }),
  async delete(id) {
    await db.character.delete({ where: { id } })
  },
})
