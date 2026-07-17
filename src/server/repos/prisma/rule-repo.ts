import type { RuleRepo } from "../../ports/repos"
import type { PrismaDb } from "./db-client"

export const prismaRuleRepo = (db: PrismaDb): RuleRepo => ({
  create: (data) => db.rule.create({ data }),
  getById: (id) => db.rule.findUnique({ where: { id } }),
  listByStory: (storyId) =>
    db.rule.findMany({ where: { storyId }, orderBy: { createdAt: "asc" } }),
  update: (id, data) => db.rule.update({ where: { id }, data }),
  async delete(id) {
    await db.rule.delete({ where: { id } })
  },
})
