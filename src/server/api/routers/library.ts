import { TRPCError } from "@trpc/server"
import { z } from "zod"

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"
import { characterInputSchema } from "@/server/domain/schemas"
import type { Repos } from "@/server/ports/repos"
import { clientLibraryCharacter } from "@/server/services/assets"

const libraryCharacterInput = z.object({
  libraryCharacterId: z.string().min(1),
})

async function ownedLibraryCharacter(id: string, userId: string, repos: Repos) {
  const character = await repos.libraryCharacters.getOwnedById(id, userId)
  if (!character) throw new TRPCError({ code: "NOT_FOUND" })
  return character
}

const characters = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) =>
    (
      await ctx.deps.repos.libraryCharacters.listByUser(ctx.session.user.id)
    ).map(clientLibraryCharacter)
  ),
  create: protectedProcedure
    .input(z.object({ character: characterInputSchema }))
    .mutation(async ({ ctx, input }) =>
      clientLibraryCharacter(
        await ctx.deps.repos.libraryCharacters.create({
          userId: ctx.session.user.id,
          ...input.character,
        })
      )
    ),
  update: protectedProcedure
    .input(libraryCharacterInput.extend({ character: characterInputSchema }))
    .mutation(async ({ ctx, input }) => {
      await ownedLibraryCharacter(
        input.libraryCharacterId,
        ctx.session.user.id,
        ctx.deps.repos
      )
      return clientLibraryCharacter(
        await ctx.deps.repos.libraryCharacters.update(
          input.libraryCharacterId,
          input.character
        )
      )
    }),
  delete: protectedProcedure
    .input(libraryCharacterInput)
    .mutation(async ({ ctx, input }) => {
      const character = await ownedLibraryCharacter(
        input.libraryCharacterId,
        ctx.session.user.id,
        ctx.deps.repos
      )
      const photo = character.photoAssetId
        ? await ctx.deps.repos.assets.getById(character.photoAssetId)
        : null
      await ctx.deps.repos.transaction(async (repos) => {
        await repos.libraryCharacters.delete(character.id)
        if (photo) await repos.assets.delete(photo.id)
      })
      if (photo) {
        await ctx.deps.storage
          .delete(photo.storageLocator)
          .catch(() => undefined)
      }
      return { success: true }
    }),
})

export const libraryRouter = createTRPCRouter({ characters })
