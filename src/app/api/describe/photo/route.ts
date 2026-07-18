import { headers } from "next/headers"

import { assertStoryOwnership } from "@/server/api/ownership"
import type { InputImage } from "@/server/ai"
import { getServerSession } from "@/server/auth-session"
import { getDeps } from "@/server/container"
import { validateUpload } from "@/server/domain/upload"
import { normalizeUploadedImage } from "@/server/services/photo"

const error = (message: string, status: number) =>
  Response.json({ error: message }, { status })

export async function POST(request: Request) {
  const session = await getServerSession(await headers())
  if (!session) return error("Unauthorized", 401)

  const form = await request.formData()
  const storyId = form.get("storyId")
  const file = form.get("file")
  if (
    (storyId !== null && typeof storyId !== "string") ||
    !(file instanceof File)
  ) {
    return error("file is required", 400)
  }

  const validation = validateUpload({ mimeType: file.type, size: file.size })
  if (!validation.valid) return error(validation.error, 400)

  const deps = getDeps()
  if (storyId) {
    try {
      await assertStoryOwnership(deps.repos, storyId, session.user.id)
    } catch {
      return error("Not found", 404)
    }
  }

  let image: Buffer
  try {
    image = await normalizeUploadedImage(Buffer.from(await file.arrayBuffer()))
  } catch {
    return error("Photo could not be read", 400)
  }

  try {
    const photo: InputImage = { data: image, mediaType: "image/png" }
    const result = await deps.ai.characterPhotoAutofill.suggest({
      photo,
    })
    return Response.json(result)
  } catch {
    return error("Could not auto-fill from this photo. Please try again.", 502)
  }
}
