import { TRPCError } from "@trpc/server"
import { z } from "zod"

import { assertStoryOwnership } from "@/server/api/ownership"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"
import { pdfUrlFromTask } from "@/server/domain/pdfPlan"
import { hasActiveTask } from "@/server/domain/taskMachine"
import { createTask } from "@/server/services/tasks"

const storyInput = z.object({ storyId: z.string().min(1) })

export const pdfRouter = createTRPCRouter({
  export: protectedProcedure
    .input(storyInput)
    .mutation(async ({ ctx, input }) => {
      await assertStoryOwnership(
        ctx.deps.repos,
        input.storyId,
        ctx.session.user.id
      )
      // Refuse a second export while one is queued/running — they'd race on the
      // same PDF blob key and the user couldn't tell which download won.
      const tasks = await ctx.deps.repos.tasks.listByStory(input.storyId)
      if (hasActiveTask(tasks, { type: "PDF_EXPORT" })) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An export is already in progress for this story",
        })
      }
      const task = await createTask(ctx.deps, {
        userId: ctx.session.user.id,
        storyId: input.storyId,
        type: "PDF_EXPORT",
      })
      return { taskId: task.id }
    }),

  latest: protectedProcedure.input(storyInput).query(async ({ ctx, input }) => {
    await assertStoryOwnership(
      ctx.deps.repos,
      input.storyId,
      ctx.session.user.id
    )
    const tasks = await ctx.deps.repos.tasks.listByStory(input.storyId)
    const latest = tasks
      .filter((task) => pdfUrlFromTask(task) !== null)
      .reduce<(typeof tasks)[number] | undefined>(
        (newest, task) =>
          !newest || task.createdAt > newest.createdAt ? task : newest,
        undefined
      )
    return { url: latest ? pdfUrlFromTask(latest) : null }
  }),
})
