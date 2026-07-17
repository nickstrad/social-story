import type { Deps } from "@/server/container"
import { pickReferencePhoto } from "@/server/domain/photoPick"
import { buildCoverPrompt, buildImagePrompt } from "@/server/domain/prompts"
import { applyRulesToPage } from "@/server/domain/rules"
import { nextVariant } from "@/server/domain/taskMachine"
import type { Character, Page, Rule, Story, Task } from "@/server/domain/types"
import { registerTaskHandler } from "@/server/inngest/handlers"
import { addCaptionBand } from "@/server/services/caption"
import { createPageImageAssets } from "@/server/services/assets"
import { toReferenceImage } from "@/server/services/references"
import { pageImageKey, pageImageRawKey } from "@/server/services/storage-keys"
import { runTaskResultStep, type TaskStepRunner } from "@/server/services/tasks"

const IMAGE_SIZE = 1024

function buildGenerationContext(
  page: Page,
  story: Story,
  characters: Character[],
  rules: Rule[]
) {
  // Apply current rules at generation time so older saved pages also respect
  // rules added after parsing.
  const { characterIds } = applyRulesToPage(
    page.characterIds,
    rules,
    characters
  )
  const charactersById = new Map(
    characters.map((character) => [character.id, character])
  )
  const pageCharacters = characterIds.flatMap((id) => {
    const character = charactersById.get(id)
    return character ? [character] : []
  })
  const isCover = page.kind === "COVER"
  const anchored =
    (isCover || pageCharacters.length > 0) && Boolean(story.baseImageAssetId)
  const prompt = isCover
    ? buildCoverPrompt({
        title: story.title,
        characters,
        note: story.coverNote ?? undefined,
      })
    : buildImagePrompt({
        scene: page.imagePrompt,
        characters: pageCharacters,
        allCharacters: characters,
        anchored,
        steeringText: page.steeringText ?? undefined,
        rules,
      })
  return { anchored, isCover, pageCharacters, prompt }
}

async function loadReferenceImages(
  deps: Deps,
  story: Story,
  pageCharacters: Character[],
  anchored: boolean
) {
  const photo = pickReferencePhoto({
    pageCharacters,
    hasAnchor: anchored,
  })
  const assetIds = [
    ...(anchored && story.baseImageAssetId ? [story.baseImageAssetId] : []),
    ...(photo?.photoAssetId ? [photo.photoAssetId] : []),
  ]
  // The character sheet remains first because the prompt identifies the first
  // reference as the visual anchor.
  return Promise.all(assetIds.map((assetId) => toReferenceImage(deps, assetId)))
}

export async function runPageImageTask(
  task: Task,
  deps: Deps,
  steps?: TaskStepRunner
) {
  return runTaskResultStep(
    steps,
    "Generate and save page illustration with AI",
    async () => {
      if (!task.pageId) throw new Error("PAGE_IMAGE task requires a pageId")
      const page = await deps.repos.pages.getById(task.pageId)
      if (!page) throw new Error("Page not found")
      const story = await deps.repos.stories.getById(task.storyId)
      if (!story) throw new Error("Story not found")

      const [characters, rules] = await Promise.all([
        deps.repos.characters.listByStory(task.storyId),
        deps.repos.rules.listByStory(task.storyId),
      ])
      const { anchored, isCover, pageCharacters, prompt } =
        buildGenerationContext(page, story, characters, rules)
      const referenceImages = await loadReferenceImages(
        deps,
        story,
        pageCharacters,
        anchored
      )

      // The variant read doesn't depend on the (multi-second) render, so overlap it.
      const [raw, existing] = await Promise.all([
        deps.image.generate({
          prompt,
          referenceImages,
          width: IMAGE_SIZE,
          height: IMAGE_SIZE,
        }),
        deps.repos.pages.listImages(page.id),
      ])
      const variant = nextVariant(existing.map((image) => image.variant))

      // Captioning is not idempotent, so it always runs against the raw source; the
      // raw upload is independent of it, so both run together.
      const captioned = await addCaptionBand(
        raw,
        isCover ? story.title : page.text
      )
      const image = await createPageImageAssets(deps, {
        userId: story.userId,
        storyId: story.id,
        pageId: page.id,
        promptUsed: prompt,
        variant,
        raw,
        captioned,
        rawKey: pageImageRawKey(task.storyId, page.id, variant),
        captionedKey: pageImageKey(task.storyId, page.id, variant),
      })

      return {
        request: {
          pageKind: page.kind,
          characterCount: pageCharacters.length,
          referenceImageCount: referenceImages.length,
          anchoredToCharacterSheet: anchored,
          outputSize: `${IMAGE_SIZE}x${IMAGE_SIZE}`,
        },
        response: {
          pageImageId: image.id,
          variant,
          rawImageBytes: raw.byteLength,
          captionedImageBytes: captioned.byteLength,
        },
        result: { pageImageId: image.id },
      }
    }
  )
}

registerTaskHandler("PAGE_IMAGE", runPageImageTask)
