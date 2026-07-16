import { TRPCError } from "@trpc/server"
import { z } from "zod"

import { assertStoryOwnership } from "@/server/api/ownership"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"
import type { Deps } from "@/server/container"
import type { Task } from "@/server/domain/types"
import {
  createTask,
  listStoryTasks,
  recoverStaleTask,
} from "@/server/services/tasks"

const taskIdInput = z.object({ taskId: z.string().min(1) })

async function getOwnedTask(
  deps: Deps,
  taskId: string,
  userId: string
): Promise<Task> {
  const stored = await deps.repos.tasks.getById(taskId)
  if (!stored || stored.userId !== userId) {
    throw new TRPCError({ code: "NOT_FOUND" })
  }
  return recoverStaleTask(deps, stored)
}

export const taskRouter = createTRPCRouter({
  get: protectedProcedure.input(taskIdInput).query(async ({ ctx, input }) => {
    return getOwnedTask(ctx.deps, input.taskId, ctx.session.user.id)
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
      const tasks = await listStoryTasks(ctx.deps, input.storyId)
      return input.activeOnly
        ? tasks.filter(
            (task) => task.status === "PENDING" || task.status === "RUNNING"
          )
        : tasks
    }),

  retry: protectedProcedure
    .input(taskIdInput)
    .mutation(async ({ ctx, input }) => {
      const task = await getOwnedTask(
        ctx.deps,
        input.taskId,
        ctx.session.user.id
      )
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
