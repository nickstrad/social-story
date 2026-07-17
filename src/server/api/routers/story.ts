import { TRPCError } from "@trpc/server"
import { z } from "zod"

import { assertStoryOwnership } from "@/server/api/ownership"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"
import { isPageVisible } from "@/server/domain/pageOps"
import { hasActiveTask } from "@/server/domain/taskMachine"
import { createTask, listStoryTasks } from "@/server/services/tasks"
import {
  assetUrl,
  clientCharacter,
  clientStory,
} from "@/server/services/assets"

const storyInput = z.object({ storyId: z.string().min(1) })
const scriptSchema = z.string().trim().min(1).max(50_000)
const titleSchema = z.string().trim().max(200)

export const storyRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({ title: titleSchema.optional(), script: scriptSchema }))
    .mutation(async ({ ctx, input }) => {
      const story = await ctx.deps.repos.stories.create({
        userId: ctx.session.user.id,
        title: input.title ?? "",
        script: input.script,
        status: "DRAFT",
      })
      return clientStory(story)
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return (await ctx.deps.repos.stories.listByUser(ctx.session.user.id)).map(
      clientStory
    )
  }),

  get: protectedProcedure.input(storyInput).query(async ({ ctx, input }) => {
    const story = await assertStoryOwnership(
      ctx.deps.repos,
      input.storyId,
      ctx.session.user.id
    )
    const [characters, rules, pages] = await Promise.all([
      ctx.deps.repos.characters.listByStory(story.id),
      ctx.deps.repos.rules.listByStory(story.id),
      ctx.deps.repos.pages.listByStory(story.id),
    ])
    // Attach each page's selected image URL so the editor grid can render
    // thumbnails without an extra per-card query — one batched query, not N.
    const images = await ctx.deps.repos.pages.listImagesByStory(story.id)
    const assetIdById = new Map(
      images.map((image) => [image.id, image.imageAssetId])
    )
    const pagesWithImage = pages.map((page) => {
      const selectedAssetId = page.selectedImageId
        ? assetIdById.get(page.selectedImageId)
        : undefined
      return {
        ...page,
        selectedImageUrl: selectedAssetId ? assetUrl(selectedAssetId) : null,
      }
    })

    // Export is gated on visible pages that have a chosen image, so a hidden
    // page or a page with only unselected variants doesn't unlock it.
    const pagesWithImageCount = pagesWithImage.filter(
      (page) => page.selectedImageUrl !== null && isPageVisible(page)
    ).length

    return {
      ...clientStory(story),
      characters: characters.map(clientCharacter),
      rules,
      pages: pagesWithImage,
      counts: {
        characters: characters.length,
        rules: rules.length,
        pages: pages.length,
        pagesWithImage: pagesWithImageCount,
      },
    }
  }),

  updateScript: protectedProcedure
    .input(storyInput.extend({ script: scriptSchema }))
    .mutation(async ({ ctx, input }) => {
      await assertStoryOwnership(
        ctx.deps.repos,
        input.storyId,
        ctx.session.user.id
      )
      return ctx.deps.repos.stories.update(input.storyId, {
        script: input.script,
      })
    }),

  updateTitle: protectedProcedure
    .input(storyInput.extend({ title: titleSchema }))
    .mutation(async ({ ctx, input }) => {
      await assertStoryOwnership(
        ctx.deps.repos,
        input.storyId,
        ctx.session.user.id
      )
      return ctx.deps.repos.stories.update(input.storyId, {
        title: input.title,
      })
    }),

  updateCoverNote: protectedProcedure
    .input(storyInput.extend({ coverNote: z.string().trim().max(2_000) }))
    .mutation(async ({ ctx, input }) => {
      await assertStoryOwnership(
        ctx.deps.repos,
        input.storyId,
        ctx.session.user.id
      )
      return ctx.deps.repos.stories.update(input.storyId, {
        coverNote: input.coverNote || null,
      })
    }),

  delete: protectedProcedure
    .input(storyInput)
    .mutation(async ({ ctx, input }) => {
      const story = await assertStoryOwnership(
        ctx.deps.repos,
        input.storyId,
        ctx.session.user.id
      )
      const assets = await ctx.deps.repos.transaction(async (repos) => {
        const storyAssets = await repos.assets.listByStory(story.id)
        const pages = await repos.pages.listByStory(story.id)
        // PageImage holds a restrictive reference to its processed asset. Drop
        // the pages (and their images) before removing the story's asset rows.
        for (const page of pages) await repos.pages.delete(page.id)
        for (const asset of storyAssets) await repos.assets.delete(asset.id)
        await repos.stories.delete(story.id)
        return storyAssets
      })
      await Promise.all(
        assets.map((asset) =>
          ctx.deps.storage.delete(asset.storageLocator).catch(() => undefined)
        )
      )
      return { success: true }
    }),

  parse: protectedProcedure
    .input(storyInput)
    .mutation(async ({ ctx, input }) => {
      const story = await assertStoryOwnership(
        ctx.deps.repos,
        input.storyId,
        ctx.session.user.id
      )
      // Guard against two destructive re-parses racing on the same story: both
      // would call replaceAll and interleave their page/title/status writes.
      const tasks = await listStoryTasks(ctx.deps, story.id)
      if (hasActiveTask(tasks, { type: "PARSE_STORY" })) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A parse is already in progress for this story",
        })
      }
      const task = await createTask(ctx.deps, {
        userId: ctx.session.user.id,
        storyId: story.id,
        type: "PARSE_STORY",
      })
      return { taskId: task.id }
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
      const tasks = await listStoryTasks(ctx.deps, input.storyId)
      if (hasActiveTask(tasks, { type: "BASE_IMAGE" })) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A base image is already generating for this story",
        })
      }
      return createTask(ctx.deps, {
        userId: ctx.session.user.id,
        storyId: input.storyId,
        type: "BASE_IMAGE",
      })
    }),
})
