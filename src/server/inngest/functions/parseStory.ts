import type { ParsedStory } from "@/server/domain/schemas"
import { parsedStoryToPages } from "@/server/domain/pageOps"
import { applyRulesToStory } from "@/server/domain/rules"
import type { CreatePage, Page, Task, UpdateStory } from "@/server/domain/types"
import { toCharacterContext, toRuleContext } from "@/server/ai"
import { registerTaskHandler } from "@/server/inngest/handlers"
import type { Deps } from "@/server/container"
import {
  runTaskResultStep,
  runTaskStep,
  type TaskStepRunner,
} from "@/server/services/tasks"

async function loadStoryContext(task: Task, deps: Deps) {
  const story = await deps.repos.stories.getById(task.storyId)
  if (!story) throw new Error("Story not found")
  const [characters, rules, pages] = await Promise.all([
    deps.repos.characters.listByStory(story.id),
    deps.repos.rules.listByStory(story.id),
    deps.repos.pages.listByStory(story.id),
  ])
  return { story, characters, rules, pages }
}

type StoryContext = Awaited<ReturnType<typeof loadStoryContext>>

async function assertPagesCanBeReplaced(deps: Deps, pages: Page[]) {
  const imageLists = await Promise.all(
    pages.map((page) => deps.repos.pages.listImages(page.id))
  )
  if (imageLists.some((images) => images.length > 0)) {
    throw new Error(
      "Cannot re-parse: some pages already have generated images. Remove those images first."
    )
  }
}

async function storyConversionRequest(task: Task, deps: Deps) {
  const { story, characters, rules, pages } = await loadStoryContext(task, deps)
  await assertPagesCanBeReplaced(deps, pages)
  return {
    request: {
      scriptCharacterCount: story.script.length,
      characterCount: characters.length,
      visualRuleCount: rules.length,
      existingPageCount: pages.length,
    },
    response: { readyForConversion: true },
  }
}

async function convertStoryToJson(
  context: StoryContext,
  deps: Deps
): Promise<ParsedStory> {
  return deps.ai.storyToData.convert({
    script: context.story.script,
    characters: context.characters.map(toCharacterContext),
    rules: context.rules.map(toRuleContext),
  })
}

async function saveConvertedPages(
  context: StoryContext,
  deps: Deps,
  parsed: ParsedStory
) {
  // Re-parse is destructive. Refuse rather than silently discard pages whose
  // generated art the user has already invested in. Check again because the
  // AI call and persistence are kept inside one durable step so the parsed
  // story content is never exposed as an Inngest step output.
  const currentPages = await deps.repos.pages.listByStory(context.story.id)
  await assertPagesCanBeReplaced(deps, currentPages)

  const pages = parsedStoryToPages(parsed, context.characters)
  const { pages: ruledPages } = applyRulesToStory(
    pages,
    context.rules,
    context.characters
  )
  const created = await deps.repos.pages.replaceAll(
    context.story.id,
    ruledPages.map(toCreatePage)
  )

  const update: UpdateStory = { status: "PARSED" }
  if (!context.story.title.trim()) update.title = parsed.title
  await deps.repos.stories.update(context.story.id, update)

  return {
    pageCount: created.length,
    titleWasGenerated: !context.story.title.trim(),
  }
}

export async function runParseStoryTask(
  task: Task,
  deps: Deps,
  steps?: TaskStepRunner
) {
  const request = await runTaskStep(
    steps,
    "Check story conversion request",
    () => storyConversionRequest(task, deps)
  )
  return runTaskResultStep(
    steps,
    "Convert story to structured page JSON with AI and save pages",
    async () => {
      const context = await loadStoryContext(task, deps)
      const parsed = await convertStoryToJson(context, deps)
      const saved = await saveConvertedPages(context, deps, parsed)
      const result = { pageCount: saved.pageCount }
      return {
        request: request.request,
        response: {
          parsedContentPageCount: parsed.pages.length,
          savedPageCount: saved.pageCount,
          coverPageAdded: true,
          titleWasGenerated: saved.titleWasGenerated,
        },
        result,
      }
    }
  )
}

registerTaskHandler("PARSE_STORY", runParseStoryTask)

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
