import type { Prisma } from "@/generated/prisma"
import {
  decodeCursor,
  pageOrderedList,
  type LibraryCharacterSortField,
  type ListParams,
} from "@/lib/validation/listParams"

import type { LibraryCharacterRepo } from "../../ports/repos"
import type { PrismaDb } from "./db-client"

function characterCursorWhere(
  params: ListParams<LibraryCharacterSortField>
): Prisma.LibraryCharacterWhereInput {
  if (!params.cursor) return {}
  const { v, id } = decodeCursor(params.cursor)
  const comparison = params.sort.dir === "asc" ? "gt" : "lt"
  const idFilter = { [comparison]: id }

  if (params.sort.field === "name") {
    return {
      OR: [
        { name: { [comparison]: String(v) } },
        { name: String(v), id: idFilter },
      ],
    }
  }
  const value = new Date(String(v))
  return {
    OR: [
      { createdAt: { [comparison]: value } },
      { createdAt: value, id: idFilter },
    ],
  }
}

function characterOrderBy(
  params: ListParams<LibraryCharacterSortField>
): Prisma.LibraryCharacterOrderByWithRelationInput[] {
  const direction = params.sort.dir
  return params.sort.field === "name"
    ? [{ name: direction }, { id: direction }]
    : [{ createdAt: direction }, { id: direction }]
}

export const prismaLibraryCharacterRepo = (
  db: PrismaDb
): LibraryCharacterRepo => ({
  create: (data) => db.libraryCharacter.create({ data }),
  getOwnedById: (id, userId) =>
    db.libraryCharacter.findFirst({ where: { id, userId } }),
  listByUser: (userId) =>
    db.libraryCharacter.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }),
  async listByUserPaged(userId, params) {
    const rows = await db.libraryCharacter.findMany({
      where: { userId, ...characterCursorWhere(params) },
      orderBy: characterOrderBy(params),
      take: params.limit + 1,
    })
    return pageOrderedList(rows, params)
  },
  update: (id, data) => db.libraryCharacter.update({ where: { id }, data }),
  async delete(id) {
    await db.libraryCharacter.delete({ where: { id } })
  },
})
