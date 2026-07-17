import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"
import {
  collectArtifacts,
  type StoryArtifactSources,
} from "@/server/domain/artifacts"

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

export const artifactRouter = createTRPCRouter({
  /**
   * Every generated blob the signed-in user owns, newest first. Scoped by
   * listByUser, so ownership is enforced by construction — there is no
   * artifact lookup that could reach another user's story.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const stories = await ctx.deps.repos.stories.listByUser(ctx.session.user.id)
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
    const assetsByStory = groupBy(assets, (item) => item.storyId)

    const sources: StoryArtifactSources[] = stories.map((story) => ({
      story,
      characters: charactersByStory.get(story.id) ?? [],
      pages: pagesByStory.get(story.id) ?? [],
      pageImages: imagesByStory.get(story.id) ?? [],
      tasks: tasksByStory.get(story.id) ?? [],
      assets: assetsByStory.get(story.id) ?? [],
    }))
    return collectArtifacts(sources)
  }),
})
