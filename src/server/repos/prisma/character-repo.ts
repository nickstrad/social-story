import type { PrismaClient } from "@prisma/client"

import type { CharacterRepo } from "../../ports/repos"

export const prismaCharacterRepo = (db: PrismaClient): CharacterRepo => ({
  create: (data) => db.character.create({ data }),
  getById: (id) => db.character.findUnique({ where: { id } }),
  listByStory: (storyId) =>
    db.character.findMany({
      where: { storyId },
      orderBy: { createdAt: "asc" },
    }),
  update: (id, data) => db.character.update({ where: { id }, data }),
  async delete(id) {
    await db.character.delete({ where: { id } })
  },
})
