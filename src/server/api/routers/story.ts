import { TRPCError } from "@trpc/server"
import { z } from "zod"

import { assertStoryOwnership } from "@/server/api/ownership"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"
import type { Deps } from "@/server/container"
import { isPageVisible } from "@/server/domain/pageOps"
import { hasActiveTask } from "@/server/domain/taskMachine"
import type { Story } from "@/server/domain/types"
import { createTask } from "@/server/services/tasks"

const storyInput = z.object({ storyId: z.string().min(1) })
const scriptSchema = z.string().trim().min(1).max(50_000)
const titleSchema = z.string().trim().max(200)

export const storyRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({ title: titleSchema.optional(), script: scriptSchema }))
    .mutation(async ({ ctx, input }) => {
      return ctx.deps.repos.stories.create({
        userId: ctx.session.user.id,
        title: input.title ?? "",
        script: input.script,
        status: "DRAFT",
      })
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.deps.repos.stories.listByUser(ctx.session.user.id)
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
    const urlById = new Map(images.map((image) => [image.id, image.url]))
    const pagesWithImage = pages.map((page) => ({
      ...page,
      selectedImageUrl: page.selectedImageId
        ? (urlById.get(page.selectedImageId) ?? null)
        : null,
    }))

    // Export is gated on visible pages that have a chosen image, so a hidden
    // page or a page with only unselected variants doesn't unlock it.
    const pagesWithImageCount = pagesWithImage.filter(
      (page) => page.selectedImageUrl !== null && isPageVisible(page)
    ).length

    return {
      ...story,
      characters,
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
      await deleteStoryBlobs(ctx.deps, story)
      await ctx.deps.repos.stories.delete(story.id)
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
      const tasks = await ctx.deps.repos.tasks.listByStory(story.id)
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
      return createTask(ctx.deps, {
        userId: ctx.session.user.id,
        storyId: input.storyId,
        type: "BASE_IMAGE",
      })
    }),
})

/**
 * Best-effort cleanup of a story's blobs before the DB rows cascade away. A
 * failed blob delete (already gone, transient error) must never block the
 * database delete, so failures are swallowed per-URL.
 */
async function deleteStoryBlobs(deps: Deps, story: Story): Promise<void> {
  const [characters, pageImages] = await Promise.all([
    deps.repos.characters.listByStory(story.id),
    deps.repos.pages.listImagesByStory(story.id),
  ])

  const urls = [
    story.baseImageUrl,
    ...characters.map((character) => character.photoUrl),
    ...pageImages.flatMap((image) => [image.url, image.rawUrl]),
  ].filter((url): url is string => Boolean(url))

  await Promise.all(
    urls.map((url) => deps.storage.delete(url).catch(() => undefined))
  )
}
