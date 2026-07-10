import { TRPCError } from "@trpc/server"
import { z } from "zod"

import { assertStoryOwnership } from "@/server/api/ownership"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"
import type { Deps } from "@/server/container"
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
    const pagesWithImageCount = (
      await Promise.all(
        pages.map((page) => ctx.deps.repos.pages.listImages(page.id))
      )
    ).filter((images) => images.length > 0).length

    return {
      ...story,
      characters,
      rules,
      pages,
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
      if (
        tasks.some(
          (task) =>
            task.type === "PARSE_STORY" &&
            (task.status === "PENDING" || task.status === "RUNNING")
        )
      ) {
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
})

/**
 * Best-effort cleanup of a story's blobs before the DB rows cascade away. A
 * failed blob delete (already gone, transient error) must never block the
 * database delete, so failures are swallowed per-URL.
 */
async function deleteStoryBlobs(deps: Deps, story: Story): Promise<void> {
  const [characters, pages] = await Promise.all([
    deps.repos.characters.listByStory(story.id),
    deps.repos.pages.listByStory(story.id),
  ])
  const pageImages = (
    await Promise.all(pages.map((page) => deps.repos.pages.listImages(page.id)))
  ).flat()

  const urls = [
    story.baseImageUrl,
    ...characters.map((character) => character.photoUrl),
    ...pageImages.flatMap((image) => [image.url, image.rawUrl]),
  ].filter((url): url is string => Boolean(url))

  await Promise.all(
    urls.map((url) => deps.storage.delete(url).catch(() => undefined))
  )
}
