import { TRPCError } from "@trpc/server"
import { z } from "zod"

import { assertStoryOwnership } from "@/server/api/ownership"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"
import { pdfAssetIdFromTask } from "@/server/domain/pdfPlan"
import { hasActiveTask, latestTask } from "@/server/domain/taskMachine"
import { createTask, listStoryTasks } from "@/server/services/tasks"
import { assetUrl } from "@/server/services/assets"

const storyInput = z.object({ storyId: z.string().min(1) })

export const pdfRouter = createTRPCRouter({
  export: protectedProcedure
    .input(storyInput)
    .mutation(async ({ ctx, input }) => {
      const story = await assertStoryOwnership(
        ctx.deps.repos,
        input.storyId,
        ctx.session.user.id
      )
      if (story.kind !== "STORY") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Templates cannot be exported; create a story from this template first",
        })
      }
      // Refuse a second export while one is queued/running — they'd race on the
      // same PDF blob key and the user couldn't tell which download won.
      const tasks = await listStoryTasks(ctx.deps, input.storyId)
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
    const tasks = await listStoryTasks(ctx.deps, input.storyId)
    const latest = latestTask(
      tasks,
      (task) => pdfAssetIdFromTask(task) !== null
    )
    const assetId = latest ? pdfAssetIdFromTask(latest) : null
    const asset = assetId
      ? await ctx.deps.repos.assets.getOwnedById(assetId, ctx.session.user.id, [
          "PDF",
        ])
      : null
    return { url: asset ? assetUrl(asset.id) : null }
  }),
})
