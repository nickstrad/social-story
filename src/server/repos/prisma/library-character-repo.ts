import type { LibraryCharacterRepo } from "../../ports/repos"
import type { PrismaDb } from "./db-client"

export const prismaLibraryCharacterRepo = (
  db: PrismaDb
): LibraryCharacterRepo => ({
  create: (data) => db.libraryCharacter.create({ data }),
  getOwnedById: (id, userId) =>
    db.libraryCharacter.findFirst({ where: { id, userId } }),
  listByUser: (userId) =>
    db.libraryCharacter.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
  update: (id, data) => db.libraryCharacter.update({ where: { id }, data }),
  async delete(id) {
    await db.libraryCharacter.delete({ where: { id } })
  },
})
