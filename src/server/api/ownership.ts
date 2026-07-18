import { TRPCError } from "@trpc/server"

import type { Page, Story } from "@/server/domain/types"
import type { Repos } from "@/server/ports/repos"

const notFound = () => new TRPCError({ code: "NOT_FOUND" })

export async function assertStoryOwnership(
  repos: Repos,
  storyId: string,
  userId: string
): Promise<Story> {
  const story = await repos.stories.getById(storyId)
  if (!story || story.userId !== userId) throw notFound()
  return story
}

export async function assertTemplateUsable(
  repos: Repos,
  templateOrId: Story | string,
  userId: string
): Promise<Story> {
  const template =
    typeof templateOrId === "string"
      ? await assertStoryOwnership(repos, templateOrId, userId)
      : templateOrId
  if (template.userId !== userId || template.kind !== "TEMPLATE") {
    throw notFound()
  }
  return template
}

export async function assertPageOwnership(
  repos: Repos,
  pageId: string,
  userId: string
): Promise<Page> {
  const page = await repos.pages.getById(pageId)
  if (!page) throw notFound()

  await assertStoryOwnership(repos, page.storyId, userId)
  return page
}
