import { TRPCError } from "@trpc/server"
import { z } from "zod"

import { assertStoryOwnership } from "@/server/api/ownership"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"
import { ruleInputSchema } from "@/server/domain/schemas"
import type { Character } from "@/server/domain/types"

const storyInput = z.object({ storyId: z.string().min(1) })
const mutationInput = storyInput.extend({ ruleId: z.string().min(1) })

async function validateCharacterIds(ids: string[], characters: Character[]) {
  const known = new Set(characters.map((item) => item.id))
  if (ids.some((id) => !known.has(id)))
    throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown character" })
}

export const ruleRouter = createTRPCRouter({
  listForStory: protectedProcedure
    .input(storyInput)
    .query(async ({ ctx, input }) => {
      await assertStoryOwnership(
        ctx.deps.repos,
        input.storyId,
        ctx.session.user.id
      )
      return ctx.deps.repos.rules.listByStory(input.storyId)
    }),
  create: protectedProcedure
    .input(storyInput.extend({ rule: ruleInputSchema }))
    .mutation(async ({ ctx, input }) => {
      await assertStoryOwnership(
        ctx.deps.repos,
        input.storyId,
        ctx.session.user.id
      )
      await validateCharacterIds(
        input.rule.characterIds,
        await ctx.deps.repos.characters.listByStory(input.storyId)
      )
      return ctx.deps.repos.rules.create({
        storyId: input.storyId,
        ...input.rule,
      })
    }),
  update: protectedProcedure
    .input(mutationInput.extend({ rule: ruleInputSchema }))
    .mutation(async ({ ctx, input }) => {
      await assertStoryOwnership(
        ctx.deps.repos,
        input.storyId,
        ctx.session.user.id
      )
      const existing = await ctx.deps.repos.rules.getById(input.ruleId)
      if (!existing || existing.storyId !== input.storyId)
        throw new TRPCError({ code: "NOT_FOUND" })
      await validateCharacterIds(
        input.rule.characterIds,
        await ctx.deps.repos.characters.listByStory(input.storyId)
      )
      return ctx.deps.repos.rules.update(input.ruleId, input.rule)
    }),
  delete: protectedProcedure
    .input(mutationInput)
    .mutation(async ({ ctx, input }) => {
      await assertStoryOwnership(
        ctx.deps.repos,
        input.storyId,
        ctx.session.user.id
      )
      const existing = await ctx.deps.repos.rules.getById(input.ruleId)
      if (!existing || existing.storyId !== input.storyId)
        throw new TRPCError({ code: "NOT_FOUND" })
      await ctx.deps.repos.rules.delete(input.ruleId)
      return { success: true }
    }),
})
