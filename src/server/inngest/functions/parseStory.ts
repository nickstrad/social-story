import { parsedStorySchema } from "@/server/domain/schemas"
import { parsedStoryToPages } from "@/server/domain/pageOps"
import { buildParseSystemPrompt } from "@/server/domain/prompts"
import { applyRulesToStory } from "@/server/domain/rules"
import type { CreatePage, Page, UpdateStory } from "@/server/domain/types"
import { registerTaskHandler } from "@/server/inngest/handlers"

registerTaskHandler("PARSE_STORY", async (task, deps) => {
  const story = await deps.repos.stories.getById(task.storyId)
  if (!story) throw new Error("Story not found")

  const [characters, rules, existingPages] = await Promise.all([
    deps.repos.characters.listByStory(story.id),
    deps.repos.rules.listByStory(story.id),
    deps.repos.pages.listByStory(story.id),
  ])

  // Re-parse is destructive. Refuse rather than silently discard pages whose
  // generated art the user has already invested in.
  const imageLists = await Promise.all(
    existingPages.map((page) => deps.repos.pages.listImages(page.id))
  )
  if (imageLists.some((images) => images.length > 0)) {
    throw new Error(
      "Cannot re-parse: some pages already have generated images. Remove those images first."
    )
  }

  const parsed = await deps.text.generateJson({
    system: buildParseSystemPrompt(characters, rules),
    user: story.script,
    schema: parsedStorySchema,
  })

  const pages = parsedStoryToPages(parsed, characters)
  const { pages: ruledPages } = applyRulesToStory(pages, rules, characters)
  const created = await deps.repos.pages.replaceAll(
    story.id,
    ruledPages.map(toCreatePage)
  )

  const update: UpdateStory = { status: "PARSED" }
  if (!story.title.trim()) update.title = parsed.title
  await deps.repos.stories.update(story.id, update)

  return { pageCount: created.length }
})

// Strip the in-memory Page shape (placeholder id/storyId/timestamps) down to
// the fields a fresh page is created from; replaceAll supplies the storyId.
function toCreatePage(page: Page): Omit<CreatePage, "storyId"> {
  return {
    kind: page.kind,
    position: page.position,
    text: page.text,
    imagePrompt: page.imagePrompt,
    characterIds: page.characterIds,
  }
}
