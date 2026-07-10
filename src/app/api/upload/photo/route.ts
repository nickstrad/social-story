import { headers } from "next/headers"
import sharp from "sharp"

import { assertStoryOwnership } from "@/server/api/ownership"
import { getServerSession } from "@/server/auth-session"
import { getDeps } from "@/server/container"
import { validateUpload } from "@/server/domain/upload"
import { photoKey } from "@/server/services/storage-keys"

const error = (message: string, status: number) =>
  Response.json({ error: message }, { status })

export async function POST(request: Request) {
  const session = await getServerSession(await headers())
  if (!session) return error("Unauthorized", 401)

  const form = await request.formData()
  const storyId = form.get("storyId")
  const characterId = form.get("characterId")
  const file = form.get("file")
  if (
    typeof storyId !== "string" ||
    typeof characterId !== "string" ||
    !(file instanceof File)
  ) {
    return error("storyId, characterId, and file are required", 400)
  }

  const validation = validateUpload({ mimeType: file.type, size: file.size })
  if (!validation.valid) return error(validation.error, 400)

  const deps = getDeps()
  try {
    await assertStoryOwnership(deps.repos, storyId, session.user.id)
  } catch {
    return error("Not found", 404)
  }
  const character = await deps.repos.characters.getById(characterId)
  if (!character || character.storyId !== storyId)
    return error("Not found", 404)

  const png = await sharp(Buffer.from(await file.arrayBuffer()))
    .rotate()
    .resize({
      width: 1024,
      height: 1024,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer()
  const { url } = await deps.storage.put(
    photoKey(storyId, characterId),
    png,
    "image/png"
  )
  if (character.photoUrl && character.photoUrl !== url)
    await deps.storage.delete(character.photoUrl)
  await deps.repos.characters.update(characterId, { photoUrl: url })
  return Response.json({ url })
}
