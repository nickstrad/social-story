import { TRPCError } from "@trpc/server"
import { z } from "zod"

import { assertStoryOwnership } from "@/server/api/ownership"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"
import { createTask } from "@/server/services/tasks"

const taskIdInput = z.object({ taskId: z.string().min(1) })

export const taskRouter = createTRPCRouter({
  get: protectedProcedure.input(taskIdInput).query(async ({ ctx, input }) => {
    const task = await ctx.deps.repos.tasks.getById(input.taskId)
    if (!task || task.userId !== ctx.session.user.id) {
      throw new TRPCError({ code: "NOT_FOUND" })
    }
    return task
  }),

  listForStory: protectedProcedure
    .input(
      z.object({
        storyId: z.string().min(1),
        activeOnly: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertStoryOwnership(
        ctx.deps.repos,
        input.storyId,
        ctx.session.user.id
      )
      const tasks = await ctx.deps.repos.tasks.listByStory(input.storyId)
      return input.activeOnly
        ? tasks.filter(
            (task) => task.status === "PENDING" || task.status === "RUNNING"
          )
        : tasks
    }),

  retry: protectedProcedure
    .input(taskIdInput)
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.deps.repos.tasks.getById(input.taskId)
      if (!task || task.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }
      if (task.status !== "FAILED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only failed tasks can be retried",
        })
      }
      return createTask(ctx.deps, {
        userId: task.userId,
        storyId: task.storyId,
        pageId: task.pageId ?? undefined,
        type: task.type,
      })
    }),
})
