import type { PrismaClient } from "@prisma/client"

import type { RuleRepo } from "../../ports/repos"

export const prismaRuleRepo = (db: PrismaClient): RuleRepo => ({
  create: (data) => db.rule.create({ data }),
  listByStory: (storyId) =>
    db.rule.findMany({ where: { storyId }, orderBy: { createdAt: "asc" } }),
  update: (id, data) => db.rule.update({ where: { id }, data }),
  async delete(id) {
    await db.rule.delete({ where: { id } })
  },
})
