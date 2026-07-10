import type { PrismaClient } from "@prisma/client"

import type { PageRepo } from "../../ports/repos"

export const prismaPageRepo = (db: PrismaClient): PageRepo => ({
  create: (data) => db.page.create({ data }),
  getById: (id) => db.page.findUnique({ where: { id } }),
  listByStory: (storyId) =>
    db.page.findMany({ where: { storyId }, orderBy: { position: "asc" } }),
  async replaceAll(storyId, pages) {
    // Re-parse is destructive: drop existing pages and recreate from scratch.
    // Callers guard against clobbering pages that already have generated art.
    await db.$transaction([
      db.page.deleteMany({ where: { storyId } }),
      ...pages.map((data) => db.page.create({ data: { ...data, storyId } })),
    ])
    return db.page.findMany({
      where: { storyId },
      orderBy: { position: "asc" },
    })
  },
  update: (id, data) => db.page.update({ where: { id }, data }),
  async updateOrder(storyId, orderedIds) {
    await db.$transaction(
      orderedIds.map((id, position) =>
        db.page.updateMany({ where: { id, storyId }, data: { position } })
      )
    )
    return db.page.findMany({
      where: { storyId },
      orderBy: { position: "asc" },
    })
  },
  async delete(id) {
    await db.page.delete({ where: { id } })
  },
  addImage: (data) => db.pageImage.create({ data }),
  listImages: (pageId) =>
    db.pageImage.findMany({ where: { pageId }, orderBy: { variant: "asc" } }),
  listImagesByStory: (storyId) =>
    db.pageImage.findMany({
      where: { page: { storyId } },
      orderBy: { variant: "asc" },
    }),
})
