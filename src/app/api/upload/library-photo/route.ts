import { headers } from "next/headers"

import { getServerSession } from "@/server/auth-session"
import { getDeps } from "@/server/container"
import { validateUpload } from "@/server/domain/upload"
import { assetUrl, replaceLibraryPhotoAsset } from "@/server/services/assets"
import { normalizeUploadedImage } from "@/server/services/photo"
import { libraryPhotoKey } from "@/server/services/storage-keys"

const error = (message: string, status: number) =>
  Response.json({ error: message }, { status })

export async function POST(request: Request) {
  const session = await getServerSession(await headers())
  if (!session) return error("Unauthorized", 401)

  const form = await request.formData()
  const libraryCharacterId = form.get("libraryCharacterId")
  const file = form.get("file")
  if (typeof libraryCharacterId !== "string" || !(file instanceof File)) {
    return error("libraryCharacterId and file are required", 400)
  }

  const validation = validateUpload({ mimeType: file.type, size: file.size })
  if (!validation.valid) return error(validation.error, 400)

  const deps = getDeps()
  const character = await deps.repos.libraryCharacters.getOwnedById(
    libraryCharacterId,
    session.user.id
  )
  if (!character) return error("Not found", 404)

  let png: Buffer
  try {
    png = await normalizeUploadedImage(Buffer.from(await file.arrayBuffer()))
  } catch {
    return error("Photo could not be read", 400)
  }
  const asset = await replaceLibraryPhotoAsset(
    deps,
    character,
    png,
    libraryPhotoKey(session.user.id, character.id)
  )
  return Response.json({ assetId: asset.id, url: assetUrl(asset.id) })
}
