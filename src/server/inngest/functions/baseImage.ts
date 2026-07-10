import type { Deps } from "@/server/container"
import { buildBaseSheetPrompt } from "@/server/domain/prompts"
import type { Character, Task } from "@/server/domain/types"
import { registerTaskHandler } from "@/server/inngest/handlers"
import { baseImageKey } from "@/server/services/storage-keys"

async function loadReferenceImages(
  deps: Deps,
  characters: Character[]
): Promise<{ data: Buffer; mimeType: string }[]> {
  const withPhotos = characters.filter(
    (character): character is Character & { photoUrl: string } =>
      Boolean(character.photoUrl)
  )
  // The upload route re-encodes every photo to PNG before storing, so stored
  // photo blobs are always PNG (see src/app/api/upload/photo/route.ts).
  return Promise.all(
    withPhotos.map(async (character) => ({
      data: await deps.storage.fetchBuffer(character.photoUrl),
      mimeType: "image/png",
    }))
  )
}

export async function runBaseImageTask(task: Task, deps: Deps) {
  const characters = await deps.repos.characters.listByStory(task.storyId)
  const referenceImages = await loadReferenceImages(deps, characters)

  const png = await deps.image.generate({
    prompt: buildBaseSheetPrompt(characters),
    referenceImages,
    width: 1024,
    height: 1024,
  })

  const { url } = await deps.storage.put(
    baseImageKey(task.storyId),
    png,
    "image/png"
  )

  // Capture the previous base URL BEFORE the swap so we can clean up its blob.
  // (Reading concurrently with the update would race — the read could observe
  // the new URL and skip the delete, orphaning the old blob.)
  const previous = await deps.repos.stories.getById(task.storyId)
  await deps.repos.stories.update(task.storyId, { baseImageUrl: url })

  // Blob puts get random suffixes, so the previous base blob would orphan.
  // Best-effort delete after the swap; a stale blob must not fail the task.
  if (previous?.baseImageUrl && previous.baseImageUrl !== url) {
    try {
      await deps.storage.delete(previous.baseImageUrl)
    } catch {
      // ignore — orphaned blob is harmless
    }
  }

  return { url }
}

registerTaskHandler("BASE_IMAGE", runBaseImageTask)
