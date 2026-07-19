import { z } from "zod"

import { assertStoryOwnership } from "@/server/api/ownership"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"
import {
  collectArtifacts,
  type StoryArtifactSources,
} from "@/server/domain/artifacts"
import {
  assetUrl,
  clientCharacter,
  clientStory,
} from "@/server/services/assets"
import type { Story } from "@/server/domain/types"
import type { Repos } from "@/server/ports/repos"
import { artifactListParamsSchema } from "@/lib/validation/listParams"

function groupBy<T>(
  values: T[],
  keyFor: (value: T) => string | undefined
): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const value of values) {
    const key = keyFor(value)
    if (key === undefined) continue
    const group = groups.get(key)
    if (group) group.push(value)
    else groups.set(key, [value])
  }
  return groups
}

async function storyArtifactSnapshot(repos: Repos, story: Story) {
  const [characters, rules, pages, pageImages, tasks, assets] =
    await Promise.all([
      repos.characters.listByStory(story.id),
      repos.rules.listByStory(story.id),
      repos.pages.listByStory(story.id),
      repos.pages.listImagesByStory(story.id),
      repos.tasks.listByStory(story.id),
      repos.assets.listByStory(story.id),
    ])
  const assetIdByImageId = new Map(
    pageImages.map((image) => [image.id, image.imageAssetId])
  )
  const pagesWithImages = pages.map((page) => {
    const assetId = page.selectedImageId
      ? assetIdByImageId.get(page.selectedImageId)
      : undefined
    return {
      ...page,
      selectedImageUrl: assetId ? assetUrl(assetId) : null,
    }
  })
  return {
    story: clientStory(story),
    characters: characters.map(clientCharacter),
    rules,
    pages: pagesWithImages,
    generated: collectArtifacts([
      { story, characters, pages, pageImages, tasks, assets },
    ]),
  }
}

export const artifactRouter = createTRPCRouter({
  /** A cumulative, story-scoped snapshot for the in-flow artifacts drawer. */
  forStory: protectedProcedure
    .input(z.object({ storyId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const story = await assertStoryOwnership(
        ctx.deps.repos,
        input.storyId,
        ctx.session.user.id
      )
      return storyArtifactSnapshot(ctx.deps.repos, story)
    }),

  /**
   * Generated blobs for one cursor page of the signed-in user's stories.
   * Ownership is enforced by the paged story query, so no artifact lookup can
   * reach another user's story.
   */
  list: protectedProcedure
    .input(artifactListParamsSchema)
    .query(async ({ ctx, input }) => {
      const storyPage = await ctx.deps.repos.stories.listByUserPaged(
        ctx.session.user.id,
        "STORY",
        input
      )
      const stories = storyPage.items
      const storyIds = stories.map((story) => story.id)
      const [characters, pages, pageImages, tasks, assets] = await Promise.all([
        ctx.deps.repos.characters.listByStoryIds(storyIds),
        ctx.deps.repos.pages.listByStoryIds(storyIds),
        ctx.deps.repos.pages.listImagesByStoryIds(storyIds),
        ctx.deps.repos.tasks.listByStoryIds(storyIds),
        ctx.deps.repos.assets.listByStoryIds(storyIds),
      ])

      const storyIdByPageId = new Map(
        pages.map((page) => [page.id, page.storyId])
      )
      const charactersByStory = groupBy(characters, (item) => item.storyId)
      const pagesByStory = groupBy(pages, (item) => item.storyId)
      const imagesByStory = groupBy(pageImages, (item) =>
        storyIdByPageId.get(item.pageId)
      )
      const tasksByStory = groupBy(tasks, (item) => item.storyId)
      const assetsByStory = groupBy(assets, (item) => item.storyId ?? undefined)

      const sources: StoryArtifactSources[] = stories.map((story) => ({
        story,
        characters: charactersByStory.get(story.id) ?? [],
        pages: pagesByStory.get(story.id) ?? [],
        pageImages: imagesByStory.get(story.id) ?? [],
        tasks: tasksByStory.get(story.id) ?? [],
        assets: assetsByStory.get(story.id) ?? [],
      }))
      const items = collectArtifacts(sources)
      if (input.sort.dir === "asc") items.reverse()
      return { items, nextCursor: storyPage.nextCursor }
    }),
})
