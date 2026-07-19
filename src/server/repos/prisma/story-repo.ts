import type { Prisma } from "@/generated/prisma"
import {
  decodeCursor,
  pageOrderedList,
  type ListParams,
  type StorySortField,
} from "@/lib/validation/listParams"

import type { StoryRepo } from "../../ports/repos"
import type { PrismaDb } from "./db-client"

function storyCursorWhere(
  params: ListParams<StorySortField>
): Prisma.StoryWhereInput {
  if (!params.cursor) return {}
  const { v, id } = decodeCursor(params.cursor)
  const comparison = params.sort.dir === "asc" ? "gt" : "lt"
  const idFilter = { [comparison]: id }

  switch (params.sort.field) {
    case "title":
      return {
        OR: [
          { title: { [comparison]: String(v) } },
          { title: String(v), id: idFilter },
        ],
      }
    case "updatedAt": {
      const value = new Date(String(v))
      return {
        OR: [
          { updatedAt: { [comparison]: value } },
          { updatedAt: value, id: idFilter },
        ],
      }
    }
    case "createdAt": {
      const value = new Date(String(v))
      return {
        OR: [
          { createdAt: { [comparison]: value } },
          { createdAt: value, id: idFilter },
        ],
      }
    }
  }
}

function storyOrderBy(
  params: ListParams<StorySortField>
): Prisma.StoryOrderByWithRelationInput[] {
  const direction = params.sort.dir
  switch (params.sort.field) {
    case "title":
      return [{ title: direction }, { id: direction }]
    case "updatedAt":
      return [{ updatedAt: direction }, { id: direction }]
    case "createdAt":
      return [{ createdAt: direction }, { id: direction }]
  }
}

export const prismaStoryRepo = (db: PrismaDb): StoryRepo => ({
  create: (input) => db.story.create({ data: input }),
  getById: (id) => db.story.findUnique({ where: { id } }),
  listByUser: (userId, kind) =>
    db.story.findMany({
      where: { userId, ...(kind ? { kind } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }),
  async listByUserPaged(userId, kind, params) {
    const rows = await db.story.findMany({
      where: {
        userId,
        ...(kind ? { kind } : {}),
        ...storyCursorWhere(params),
      },
      orderBy: storyOrderBy(params),
      take: params.limit + 1,
    })
    return pageOrderedList(rows, params)
  },
  update: (id, data) => db.story.update({ where: { id }, data }),
  async delete(id) {
    await db.story.delete({ where: { id } })
  },
})
