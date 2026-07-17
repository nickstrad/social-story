import { TRPCError } from "@trpc/server"
import { z } from "zod"

import { assertStoryOwnership } from "@/server/api/ownership"
import {
  createTRPCRouter,
  protectedProcedure,
  type Context,
} from "@/server/api/trpc"
import { characterInputSchema } from "@/server/domain/schemas"
import { clientCharacter } from "@/server/services/assets"

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
