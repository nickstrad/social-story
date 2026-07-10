import { TRPCError } from "@trpc/server"
import { z } from "zod"

import { assertStoryOwnership } from "@/server/api/ownership"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"
import { createTask } from "@/server/services/tasks"

const storyInput = z.object({ storyId: z.string().min(1) })

export const storyRouter = createTRPCRouter({
  get: protectedProcedure.input(storyInput).query(async ({ ctx, input }) => {
    return assertStoryOwnership(
      ctx.deps.repos,
      input.storyId,
      ctx.session.user.id
    )
  }),

  generateBaseImage: protectedProcedure
    .input(storyInput)
    .mutation(async ({ ctx, input }) => {
      await assertStoryOwnership(
        ctx.deps.repos,
        input.storyId,
        ctx.session.user.id
      )
      const characters = await ctx.deps.repos.characters.listByStory(
        input.storyId
      )
      if (characters.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Add at least one character before generating a base image",
        })
      }
      return createTask(ctx.deps, {
        userId: ctx.session.user.id,
        storyId: input.storyId,
        type: "BASE_IMAGE",
      })
    }),
})
