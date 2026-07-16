import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"
import type { Deps } from "@/server/container"
import {
  collectArtifacts,
  type StoryArtifactSources,
} from "@/server/domain/artifacts"
import type { Story } from "@/server/domain/types"

export const artifactRouter = createTRPCRouter({
  /**
   * Every generated blob the signed-in user owns, newest first. Scoped by
   * listByUser, so ownership is enforced by construction — there is no
   * artifact lookup that could reach another user's story.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const stories = await ctx.deps.repos.stories.listByUser(ctx.session.user.id)
    const sources = await Promise.all(
      stories.map((story) => loadStorySources(ctx.deps, story))
    )
    return collectArtifacts(sources)
  }),
})

async function loadStorySources(
  deps: Deps,
  story: Story
): Promise<StoryArtifactSources> {
  const [characters, pages, pageImages, tasks] = await Promise.all([
    deps.repos.characters.listByStory(story.id),
    deps.repos.pages.listByStory(story.id),
    deps.repos.pages.listImagesByStory(story.id),
    deps.repos.tasks.listByStory(story.id),
  ])
  return { story, characters, pages, pageImages, tasks }
}
