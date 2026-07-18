import type { StoryRepo } from "../../ports/repos"
import type { PrismaDb } from "./db-client"

export const prismaStoryRepo = (db: PrismaDb): StoryRepo => ({
  create: (input) => db.story.create({ data: input }),
  getById: (id) => db.story.findUnique({ where: { id } }),
  listByUser: (userId, kind) =>
    db.story.findMany({
      where: { userId, ...(kind ? { kind } : {}) },
      orderBy: { createdAt: "desc" },
    }),
  update: (id, data) => db.story.update({ where: { id }, data }),
  async delete(id) {
    await db.story.delete({ where: { id } })
  },
})
