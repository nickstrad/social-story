import { TRPCError } from "@trpc/server"
import { z } from "zod"

import {
  assertPageOwnership,
  assertStoryOwnership,
} from "@/server/api/ownership"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"
import { hasActiveTask } from "@/server/domain/taskMachine"
import { createTask } from "@/server/services/tasks"

const pageIdInput = z.object({ pageId: z.string().min(1) })
const steeringSchema = z.string().trim().max(2_000)

export const pageRouter = createTRPCRouter({
  generate: protectedProcedure
    .input(pageIdInput.extend({ steeringText: steeringSchema.optional() }))
    .mutation(async ({ ctx, input }) => {
      const page = await assertPageOwnership(
        ctx.deps.repos,
        input.pageId,
        ctx.session.user.id
      )

      // Persist steering first (plan order) so a rejected render still records
      // the author's new direction for their next attempt.
      if (input.steeringText !== undefined) {
        await ctx.deps.repos.pages.update(page.id, {
          steeringText: input.steeringText || null,
        })
      }

      // Refuse a second render while one is already queued/running for this
      // page — variants would race and the user cannot tell them apart.
      const tasks = await ctx.deps.repos.tasks.listByStory(page.storyId)
      if (hasActiveTask(tasks, { type: "PAGE_IMAGE", pageId: page.id })) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This page is already generating an image",
        })
      }

      const task = await createTask(ctx.deps, {
        userId: ctx.session.user.id,
        storyId: page.storyId,
        pageId: page.id,
        type: "PAGE_IMAGE",
      })
      return { taskId: task.id }
    }),

  generateBulk: protectedProcedure
    .input(
      z.object({
        storyId: z.string().min(1),
        pageIds: z.array(z.string().min(1)).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertStoryOwnership(
        ctx.deps.repos,
        input.storyId,
        ctx.session.user.id
      )
      const [pages, existingTasks] = await Promise.all([
        ctx.deps.repos.pages.listByStory(input.storyId),
        ctx.deps.repos.tasks.listByStory(input.storyId),
      ])
      const validIds = new Set(pages.map((page) => page.id))
      if (!input.pageIds.every((id) => validIds.has(id))) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "All pages must belong to the story",
        })
      }

      // Skip pages already generating so bulk can't spawn a racing second task
      // for a page — the same race page.generate refuses. Report the skips so
      // the caller can surface them.
      const skipped = input.pageIds.filter((pageId) =>
        hasActiveTask(existingTasks, { type: "PAGE_IMAGE", pageId })
      )
      const toGenerate = input.pageIds.filter((id) => !skipped.includes(id))

      const tasks = await Promise.all(
        toGenerate.map((pageId) =>
          createTask(ctx.deps, {
            userId: ctx.session.user.id,
            storyId: input.storyId,
            pageId,
            type: "PAGE_IMAGE",
          })
        )
      )
      return { taskIds: tasks.map((task) => task.id), skipped }
    }),

  selectImage: protectedProcedure
    .input(pageIdInput.extend({ pageImageId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertPageOwnership(
        ctx.deps.repos,
        input.pageId,
        ctx.session.user.id
      )
      const images = await ctx.deps.repos.pages.listImages(input.pageId)
      if (!images.some((image) => image.id === input.pageImageId)) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }
      return ctx.deps.repos.pages.update(input.pageId, {
        selectedImageId: input.pageImageId,
      })
    }),

  listImages: protectedProcedure
    .input(pageIdInput)
    .query(async ({ ctx, input }) => {
      await assertPageOwnership(
        ctx.deps.repos,
        input.pageId,
        ctx.session.user.id
      )
      // Repo returns variants ascending; expose them newest-first.
      const images = await ctx.deps.repos.pages.listImages(input.pageId)
      return [...images].reverse()
    }),
})
