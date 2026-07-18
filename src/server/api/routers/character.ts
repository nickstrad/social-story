import { TRPCError } from "@trpc/server"
import { z } from "zod"

import { assertStoryOwnership } from "@/server/api/ownership"
import {
  createTRPCRouter,
  protectedProcedure,
  type Context,
} from "@/server/api/trpc"
import { characterInputSchema } from "@/server/domain/schemas"
import {
  clientCharacter,
  clientLibraryCharacter,
  copyAsset,
} from "@/server/services/assets"
import { libraryPhotoKey, photoKey } from "@/server/services/storage-keys"

const storyInput = z.object({ storyId: z.string().min(1) })
const characterMutationInput = storyInput.extend({
  characterId: z.string().min(1),
})

async function ownedCharacter(
  ctx: Context & { session: NonNullable<Context["session"]> },
  storyId: string,
  characterId: string
) {
  await assertStoryOwnership(ctx.deps.repos, storyId, ctx.session.user.id)
  const character = await ctx.deps.repos.characters.getById(characterId)
  if (!character || character.storyId !== storyId)
    throw new TRPCError({ code: "NOT_FOUND" })
  return character
}

export const characterRouter = createTRPCRouter({
  listForStory: protectedProcedure
    .input(storyInput)
    .query(async ({ ctx, input }) => {
      await assertStoryOwnership(
        ctx.deps.repos,
        input.storyId,
        ctx.session.user.id
      )
      return (await ctx.deps.repos.characters.listByStory(input.storyId)).map(
        clientCharacter
      )
    }),
  create: protectedProcedure
    .input(storyInput.extend({ character: characterInputSchema }))
    .mutation(async ({ ctx, input }) => {
      await assertStoryOwnership(
        ctx.deps.repos,
        input.storyId,
        ctx.session.user.id
      )
      return clientCharacter(
        await ctx.deps.repos.characters.create({
          storyId: input.storyId,
          ...input.character,
        })
      )
    }),
  addFromLibrary: protectedProcedure
    .input(
      storyInput.extend({
        libraryCharacterIds: z.array(z.string().min(1)).min(1).max(20),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const story = await assertStoryOwnership(
        ctx.deps.repos,
        input.storyId,
        ctx.session.user.id
      )
      const libraryCharacters = await Promise.all(
        input.libraryCharacterIds.map((id) =>
          ctx.deps.repos.libraryCharacters.getOwnedById(id, story.userId)
        )
      )
      if (libraryCharacters.some((character) => !character)) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }

      const created = []
      for (const libraryCharacter of libraryCharacters) {
        if (!libraryCharacter) continue
        let character = await ctx.deps.repos.characters.create({
          storyId: story.id,
          name: libraryCharacter.name,
          role: libraryCharacter.role,
          age: libraryCharacter.age,
          appearance: libraryCharacter.appearance,
          photoDescription: libraryCharacter.photoDescription,
          libraryCharacterId: libraryCharacter.id,
        })
        if (libraryCharacter.photoAssetId) {
          const source = await ctx.deps.repos.assets.getById(
            libraryCharacter.photoAssetId
          )
          if (!source) throw new TRPCError({ code: "NOT_FOUND" })
          const photo = await copyAsset(
            ctx.deps,
            source,
            photoKey(story.id, character.id),
            { storyId: story.id, kind: "CHARACTER_PHOTO" }
          )
          character = await ctx.deps.repos.characters.update(character.id, {
            photoAssetId: photo.id,
          })
        }
        created.push(clientCharacter(character))
      }
      return created
    }),
  saveToLibrary: protectedProcedure
    .input(characterMutationInput)
    .mutation(async ({ ctx, input }) => {
      const character = await ownedCharacter(
        ctx,
        input.storyId,
        input.characterId
      )
      if (character.libraryCharacterId) {
        const existing = await ctx.deps.repos.libraryCharacters.getOwnedById(
          character.libraryCharacterId,
          ctx.session.user.id
        )
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This character is already saved to your library",
          })
        }
      }

      let libraryCharacter = await ctx.deps.repos.libraryCharacters.create({
        userId: ctx.session.user.id,
        name: character.name,
        role: character.role,
        age: character.age,
        appearance: character.appearance,
        photoDescription: character.photoDescription,
      })
      if (character.photoAssetId) {
        const source = await ctx.deps.repos.assets.getById(
          character.photoAssetId
        )
        if (!source) throw new TRPCError({ code: "NOT_FOUND" })
        const photo = await copyAsset(
          ctx.deps,
          source,
          libraryPhotoKey(ctx.session.user.id, libraryCharacter.id),
          { storyId: null, kind: "LIBRARY_PHOTO" }
        )
        libraryCharacter = await ctx.deps.repos.libraryCharacters.update(
          libraryCharacter.id,
          { photoAssetId: photo.id }
        )
      }
      await ctx.deps.repos.characters.update(character.id, {
        libraryCharacterId: libraryCharacter.id,
      })
      return clientLibraryCharacter(libraryCharacter)
    }),
  update: protectedProcedure
    .input(characterMutationInput.extend({ character: characterInputSchema }))
    .mutation(async ({ ctx, input }) => {
      await ownedCharacter(ctx, input.storyId, input.characterId)
      return clientCharacter(
        await ctx.deps.repos.characters.update(
          input.characterId,
          input.character
        )
      )
    }),
  delete: protectedProcedure
    .input(characterMutationInput)
    .mutation(async ({ ctx, input }) => {
      const character = await ownedCharacter(
        ctx,
        input.storyId,
        input.characterId
      )
      const photo = character.photoAssetId
        ? await ctx.deps.repos.assets.getById(character.photoAssetId)
        : null
      const rules = await ctx.deps.repos.rules.listByStory(input.storyId)
      await ctx.deps.repos.transaction(async (repos) => {
        for (const rule of rules) {
          if (!rule.characterIds.includes(input.characterId)) continue
          await repos.rules.update(rule.id, {
            characterIds: rule.characterIds.filter(
              (id) => id !== input.characterId
            ),
          })
        }
        await repos.characters.delete(input.characterId)
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
