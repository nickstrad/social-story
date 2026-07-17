import { headers } from "next/headers"

import { assertStoryOwnership } from "@/server/api/ownership"
import { getServerSession } from "@/server/auth-session"
import { getDeps } from "@/server/container"
import {
  CHARACTER_PHOTO_AUTOFILL_SYSTEM_PROMPT,
  CHARACTER_PHOTO_AUTOFILL_USER_PROMPT,
} from "@/server/domain/prompts"
import { characterPhotoAutofillSchema } from "@/server/domain/schemas"
import { validateUpload } from "@/server/domain/upload"
import { normalizeReferencePhoto } from "@/server/services/photo"

const error = (message: string, status: number) =>
  Response.json({ error: message }, { status })

export async function POST(request: Request) {
  const session = await getServerSession(await headers())
  if (!session) return error("Unauthorized", 401)

  const form = await request.formData()
  const storyId = form.get("storyId")
  const file = form.get("file")
  if (typeof storyId !== "string" || !(file instanceof File)) {
    return error("storyId and file are required", 400)
  }

  const validation = validateUpload({ mimeType: file.type, size: file.size })
  if (!validation.valid) return error(validation.error, 400)

  const deps = getDeps()
  try {
    await assertStoryOwnership(deps.repos, storyId, session.user.id)
  } catch {
    return error("Not found", 404)
  }

  let image: Buffer
  try {
    image = await normalizeReferencePhoto(Buffer.from(await file.arrayBuffer()))
  } catch {
    return error("Photo could not be read", 400)
  }

  try {
    const result = await deps.text.generateJsonWithImage({
      system: CHARACTER_PHOTO_AUTOFILL_SYSTEM_PROMPT,
      user: CHARACTER_PHOTO_AUTOFILL_USER_PROMPT,
      image: { data: image, mimeType: "image/png" },
      schema: characterPhotoAutofillSchema,
      schemaName: "character_photo_details",
    })
    return Response.json(result)
  } catch {
    return error("Could not auto-fill from this photo. Please try again.", 502)
  }
}
