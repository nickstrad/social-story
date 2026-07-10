import { TRPCError } from "@trpc/server"
import { z } from "zod"

import { assertStoryOwnership } from "@/server/api/ownership"
import {
  createTRPCRouter,
  protectedProcedure,
  type Context,
} from "@/server/api/trpc"
import { characterInputSchema } from "@/server/domain/schemas"

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
      return ctx.deps.repos.characters.listByStory(input.storyId)
    }),
  create: protectedProcedure
    .input(storyInput.extend({ character: characterInputSchema }))
    .mutation(async ({ ctx, input }) => {
      await assertStoryOwnership(
        ctx.deps.repos,
        input.storyId,
        ctx.session.user.id
      )
      return ctx.deps.repos.characters.create({
        storyId: input.storyId,
        ...input.character,
      })
    }),
  update: protectedProcedure
    .input(characterMutationInput.extend({ character: characterInputSchema }))
    .mutation(async ({ ctx, input }) => {
      await ownedCharacter(ctx, input.storyId, input.characterId)
      return ctx.deps.repos.characters.update(
        input.characterId,
        input.character
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
      if (character.photoUrl) await ctx.deps.storage.delete(character.photoUrl)
      const rules = await ctx.deps.repos.rules.listByStory(input.storyId)
      await Promise.all(
        rules
          .filter((rule) => rule.characterIds.includes(input.characterId))
          .map((rule) =>
            ctx.deps.repos.rules.update(rule.id, {
              characterIds: rule.characterIds.filter(
                (id) => id !== input.characterId
              ),
            })
          )
      )
      await ctx.deps.repos.characters.delete(input.characterId)
      return { success: true }
    }),
})
