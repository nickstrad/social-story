import type { PrismaClient } from "@prisma/client"

import type { StoryRepo } from "../../ports/repos"

export const prismaStoryRepo = (db: PrismaClient): StoryRepo => ({
  create: (input) => db.story.create({ data: input }),
  getById: (id) => db.story.findUnique({ where: { id } }),
  listByUser: (userId) =>
    db.story.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
  update: (id, data) => db.story.update({ where: { id }, data }),
  async delete(id) {
    await db.story.delete({ where: { id } })
  },
})
