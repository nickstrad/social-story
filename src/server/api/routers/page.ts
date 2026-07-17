import { TRPCError } from "@trpc/server"
import { z } from "zod"

import {
  assertPageOwnership,
  assertStoryOwnership,
} from "@/server/api/ownership"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"
import { insertPage, removePage, reorderPages } from "@/server/domain/pageOps"
import { applyRulesToPage } from "@/server/domain/rules"
import { hasActiveTask } from "@/server/domain/taskMachine"
import { createTask, listStoryTasks } from "@/server/services/tasks"
import { clientPageImage } from "@/server/services/assets"

const pageIdInput = z.object({ pageId: z.string().min(1) })
const steeringSchema = z.string().trim().max(2_000)
const textSchema = z.string().max(5_000)

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
      const tasks = await listStoryTasks(ctx.deps, page.storyId)
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
        listStoryTasks(ctx.deps, input.storyId),
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

  update: protectedProcedure
    .input(
      pageIdInput.extend({
        text: textSchema.optional(),
        imagePrompt: textSchema.optional(),
        characterIds: z.array(z.string().min(1)).optional(),
        steeringText: steeringSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const page = await assertPageOwnership(
        ctx.deps.repos,
        input.pageId,
        ctx.session.user.id
      )

      const patch: {
        text?: string
        imagePrompt?: string
        characterIds?: string[]
        steeringText?: string | null
      } = {}
      if (input.text !== undefined) patch.text = input.text
      if (input.imagePrompt !== undefined) patch.imagePrompt = input.imagePrompt
      if (input.steeringText !== undefined) {
        patch.steeringText = input.steeringText || null
      }

      let effectiveIds: string[] | undefined
      if (input.characterIds !== undefined) {
        const [characters, rules] = await Promise.all([
          ctx.deps.repos.characters.listByStory(page.storyId),
          ctx.deps.repos.rules.listByStory(page.storyId),
        ])
        const valid = new Set(characters.map((character) => character.id))
        if (!input.characterIds.every((id) => valid.has(id))) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "All characters must belong to the story",
          })
        }
        // Persist the author's raw selection (generation re-applies rules at
        // render time), but return the rule-expanded list so the UI can show
        // which characters a rule auto-adds.
        patch.characterIds = input.characterIds
        effectiveIds = applyRulesToPage(
          input.characterIds,
          rules,
          characters
        ).characterIds
      }

      const updated = await ctx.deps.repos.pages.update(page.id, patch)
      return effectiveIds ? { ...updated, characterIds: effectiveIds } : updated
    }),

  add: protectedProcedure
    .input(
      z.object({
        storyId: z.string().min(1),
        afterPageId: z.string().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertStoryOwnership(
        ctx.deps.repos,
        input.storyId,
        ctx.session.user.id
      )
      const pages = await ctx.deps.repos.pages.listByStory(input.storyId)
      const content = pages
        .filter((page) => page.kind === "PAGE")
        .sort((a, b) => a.position - b.position)
      const afterIndex = input.afterPageId
        ? content.findIndex((page) => page.id === input.afterPageId)
        : content.length - 1
      if (input.afterPageId && afterIndex === -1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "afterPageId does not belong to this story",
        })
      }

      const created = await ctx.deps.repos.pages.create({
        storyId: input.storyId,
        kind: "PAGE",
        position: pages.length,
        text: "",
        imagePrompt: "",
        characterIds: [],
      })
      // Place the new page directly after the anchor, then renumber contiguously
      // with the cover pinned at position 0.
      const ordered = insertPage(pages, afterIndex + 1, created)
      await ctx.deps.repos.pages.updateOrder(
        input.storyId,
        ordered.map((page) => page.id)
      )
      return created
    }),

  remove: protectedProcedure
    .input(pageIdInput)
    .mutation(async ({ ctx, input }) => {
      const page = await assertPageOwnership(
        ctx.deps.repos,
        input.pageId,
        ctx.session.user.id
      )
      if (page.kind === "COVER") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The cover page cannot be removed",
        })
      }
      const pages = await ctx.deps.repos.pages.listByStory(page.storyId)
      const remaining = removePage(pages, page.id)
      const images = await ctx.deps.repos.pages.listImages(page.id)
      const assets = await ctx.deps.repos.assets.listByIds(
        images.flatMap((image) =>
          [image.imageAssetId, image.rawAssetId].filter((id): id is string =>
            Boolean(id)
          )
        )
      )
      await ctx.deps.repos.transaction(async (repos) => {
        await repos.pages.delete(page.id)
        await repos.pages.updateOrder(
          page.storyId,
          remaining.map((p) => p.id)
        )
        for (const asset of assets) await repos.assets.delete(asset.id)
      })
      await Promise.all(
        assets.map((asset) =>
          ctx.deps.storage.delete(asset.storageLocator).catch(() => undefined)
        )
      )
      return { success: true }
    }),

  setHidden: protectedProcedure
    .input(pageIdInput.extend({ hidden: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const page = await assertPageOwnership(
        ctx.deps.repos,
        input.pageId,
        ctx.session.user.id
      )
      return ctx.deps.repos.pages.update(page.id, { hidden: input.hidden })
    }),

  reorder: protectedProcedure
    .input(
      z.object({
        storyId: z.string().min(1),
        orderedPageIds: z.array(z.string().min(1)),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertStoryOwnership(
        ctx.deps.repos,
        input.storyId,
        ctx.session.user.id
      )
      const pages = await ctx.deps.repos.pages.listByStory(input.storyId)
      const known = new Set(pages.map((page) => page.id))
      const requested = new Set(input.orderedPageIds)
      if (
        input.orderedPageIds.length !== pages.length ||
        requested.size !== input.orderedPageIds.length ||
        !input.orderedPageIds.every((id) => known.has(id))
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "orderedPageIds must be a permutation of the story's pages",
        })
      }
      // The domain pins the cover at position 0, so a client can't dislodge it.
      const ordered = reorderPages(pages, input.orderedPageIds)
      return ctx.deps.repos.pages.updateOrder(
        input.storyId,
        ordered.map((page) => page.id)
      )
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
      return [...images].reverse().map(clientPageImage)
    }),
})
