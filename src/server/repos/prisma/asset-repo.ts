import type { AssetRepo } from "../../ports/repos"
import type { PrismaDb } from "./db-client"

export const prismaAssetRepo = (db: PrismaDb): AssetRepo => ({
  create: (data) => db.asset.create({ data }),
  getById: (id) => db.asset.findUnique({ where: { id } }),
  getOwnedById: (id, userId, kinds) =>
    db.asset.findFirst({
      where: { id, userId, ...(kinds ? { kind: { in: [...kinds] } } : {}) },
    }),
  listByIds: (ids) => db.asset.findMany({ where: { id: { in: ids } } }),
  listByStory: (storyId) => db.asset.findMany({ where: { storyId } }),
  listByStoryIds: (storyIds) =>
    db.asset.findMany({ where: { storyId: { in: storyIds } } }),
  update: (id, data) => db.asset.update({ where: { id }, data }),
  async delete(id) {
    await db.asset.delete({ where: { id } })
  },
})
