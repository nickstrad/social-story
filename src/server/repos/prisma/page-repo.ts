import type { Prisma } from "@prisma/client"

import type { PageRepo } from "../../ports/repos"
import type { PrismaDb } from "./db-client"

const runTransaction = async (
  db: PrismaDb,
  queries: PromiseLike<unknown>[]
) => {
  if ("$transaction" in db) {
    await db.$transaction(queries as Prisma.PrismaPromise<unknown>[])
    return
  }
  // An interactive transaction client cannot start these writes concurrently.
  for (const query of queries) await query
}

const listPagesByStoryIds = (db: PrismaDb, storyIds: string[]) =>
  db.page.findMany({
    where: { storyId: { in: storyIds } },
    orderBy: { position: "asc" },
  })

const listPageImagesByStoryIds = (db: PrismaDb, storyIds: string[]) =>
  db.pageImage.findMany({
    where: { page: { storyId: { in: storyIds } } },
    orderBy: { variant: "asc" },
  })

export const prismaPageRepo = (db: PrismaDb): PageRepo => ({
  create: (data) => db.page.create({ data }),
  getById: (id) => db.page.findUnique({ where: { id } }),
  listByStory: (storyId) => listPagesByStoryIds(db, [storyId]),
  listByStoryIds: (storyIds) => listPagesByStoryIds(db, storyIds),
  async replaceAll(storyId, pages) {
    // Re-parse is destructive: drop existing pages and recreate from scratch.
    // Callers guard against clobbering pages that already have generated art.
    await runTransaction(db, [
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
    await runTransaction(
      db,
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
  listImagesByStory: (storyId) => listPageImagesByStoryIds(db, [storyId]),
  listImagesByStoryIds: (storyIds) => listPageImagesByStoryIds(db, storyIds),
})
