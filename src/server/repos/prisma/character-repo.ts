import type { CharacterRepo } from "../../ports/repos"
import type { PrismaDb } from "./db-client"

const listCharactersByStoryIds = (db: PrismaDb, storyIds: string[]) =>
  db.character.findMany({
    where: { storyId: { in: storyIds } },
    orderBy: { createdAt: "asc" },
  })

export const prismaCharacterRepo = (db: PrismaDb): CharacterRepo => ({
  create: (data) => db.character.create({ data }),
  async createMany(input) {
    const created = []
    for (const data of input) created.push(await db.character.create({ data }))
    return created
  },
  getById: (id) => db.character.findUnique({ where: { id } }),
  listByStory: (storyId) => listCharactersByStoryIds(db, [storyId]),
  listByStoryIds: (storyIds) => listCharactersByStoryIds(db, storyIds),
  update: (id, data) => db.character.update({ where: { id }, data }),
  async delete(id) {
    await db.character.delete({ where: { id } })
  },
})
