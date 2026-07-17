import type { Deps } from "@/server/container"
import { pickReferencePhoto } from "@/server/domain/photoPick"
import { buildCoverPrompt, buildImagePrompt } from "@/server/domain/prompts"
import { applyRulesToPage } from "@/server/domain/rules"
import { nextVariant } from "@/server/domain/taskMachine"
import type { Character, Task } from "@/server/domain/types"
import { registerTaskHandler } from "@/server/inngest/handlers"
import type { ReferenceImage } from "@/server/ports/image"
import { addCaptionBand } from "@/server/services/caption"
import { createPageImageAssets } from "@/server/services/assets"
import { toReferenceImage } from "@/server/services/references"
import { pageImageKey, pageImageRawKey } from "@/server/services/storage-keys"

const IMAGE_SIZE = 1024

export async function runPageImageTask(task: Task, deps: Deps) {
  if (!task.pageId) throw new Error("PAGE_IMAGE task requires a pageId")
  const page = await deps.repos.pages.getById(task.pageId)
  if (!page) throw new Error("Page not found")
  const story = await deps.repos.stories.getById(task.storyId)
  if (!story) throw new Error("Story not found")

  const [characters, rules] = await Promise.all([
    deps.repos.characters.listByStory(task.storyId),
    deps.repos.rules.listByStory(task.storyId),
  ])

  // Enforce rules at generation time too, mirroring the CLI enforcing on load,
  // so a page saved before a rule was added still respects it when rendered.
  const { characterIds } = applyRulesToPage(
    page.characterIds,
    rules,
    characters
  )
  const byId = new Map<string, Character>(
    characters.map((character) => [character.id, character])
  )
  const resolved = characterIds.flatMap((id) => {
    const character = byId.get(id)
    return character ? [character] : []
  })

  const isCover = page.kind === "COVER"
  const peopled = isCover || resolved.length > 0
  const anchored = peopled && Boolean(story.baseImageAssetId)

  const prompt = isCover
    ? buildCoverPrompt({
        title: story.title,
        characters,
        note: story.coverNote ?? undefined,
      })
    : buildImagePrompt({
        scene: page.imagePrompt,
        characters: resolved,
        allCharacters: characters,
        anchored,
        steeringText: page.steeringText ?? undefined,
        rules,
      })

  // Anchor sheet FIRST (buildImagePrompt/BASE_SHEET_INSTRUCTION references "the
  // FIRST image"), then at most one deterministically-chosen character photo.
  const referenceImages: ReferenceImage[] = []
  if (anchored && story.baseImageAssetId) {
    referenceImages.push(await toReferenceImage(deps, story.baseImageAssetId))
  }
  const photoCharacter = pickReferencePhoto({
    pageCharacters: resolved,
    hasAnchor: anchored,
  })
  if (photoCharacter?.photoAssetId) {
    referenceImages.push(
      await toReferenceImage(deps, photoCharacter.photoAssetId)
    )
  }

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
  const captioned = await addCaptionBand(raw, isCover ? story.title : page.text)
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

  return { pageImageId: image.id }
}

registerTaskHandler("PAGE_IMAGE", runPageImageTask)
