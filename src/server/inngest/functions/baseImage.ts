import type { Deps } from "@/server/container"
import { toCharacterContext } from "@/server/ai"
import type { Character, Task } from "@/server/domain/types"
import { registerTaskHandler } from "@/server/inngest/handlers"
import { replaceStoryBaseAsset } from "@/server/services/assets"
import { toReferenceImage } from "@/server/services/references"
import { baseImageKey } from "@/server/services/storage-keys"
import { runTaskResultStep, type TaskStepRunner } from "@/server/services/tasks"

async function loadReferenceImages(deps: Deps, characters: Character[]) {
  const withPhotos = characters.filter(
    (character): character is Character & { photoAssetId: string } =>
      Boolean(character.photoAssetId)
  )
  return Promise.all(
    withPhotos.map(async (character) => ({
      characterName: character.name,
      photo: await toReferenceImage(deps, character.photoAssetId),
    }))
  )
}

export async function runBaseImageTask(
  task: Task,
  deps: Deps,
  steps?: TaskStepRunner
) {
  return runTaskResultStep(
    steps,
    "Generate and save character reference sheet with AI",
    async () => {
      const characters = await deps.repos.characters.listByStory(task.storyId)
      const photos = await loadReferenceImages(deps, characters)

      const { png } = await deps.ai.baseImage.generate({
        characters: characters.map(toCharacterContext),
        photos,
        dimensions: { width: 1024, height: 1024 },
      })

      const story = await deps.repos.stories.getById(task.storyId)
      if (!story) throw new Error("Story not found")
      const asset = await replaceStoryBaseAsset(
        deps,
        story,
        png,
        baseImageKey(task.storyId)
      )
      return {
        request: {
          characterCount: characters.length,
          referencePhotoCount: photos.length,
          outputSize: "1024x1024",
        },
        response: { assetId: asset.id, imageBytes: png.byteLength },
        result: { assetId: asset.id },
      }
    }
  )
}

registerTaskHandler("BASE_IMAGE", runBaseImageTask)
