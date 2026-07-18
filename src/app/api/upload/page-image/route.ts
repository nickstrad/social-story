import { TRPCError } from "@trpc/server"
import { headers } from "next/headers"

import { getServerSession } from "@/server/auth-session"
import { getDeps } from "@/server/container"
import {
  PageImageUploadError,
  uploadPageImage,
} from "@/server/services/page-image-upload"

const error = (message: string, status: number) =>
  Response.json({ error: message }, { status })

export async function POST(request: Request) {
  const session = await getServerSession(await headers())
  if (!session) return error("Unauthorized", 401)

  const form = await request.formData()
  const storyId = form.get("storyId")
  const pageId = form.get("pageId")
  const file = form.get("file")
  if (
    typeof storyId !== "string" ||
    typeof pageId !== "string" ||
    !(file instanceof File)
  ) {
    return error("storyId, pageId, and file are required", 400)
  }

  try {
    const image = await uploadPageImage(getDeps(), {
      userId: session.user.id,
      storyId,
      pageId,
      file,
    })
    return Response.json({
      imageId: image.id,
      variant: image.variant,
      url: image.url,
    })
  } catch (cause) {
    if (cause instanceof PageImageUploadError) {
      return error(
        cause.message,
        cause.code === "ACTIVE_GENERATION" ? 409 : 400
      )
    }
    if (cause instanceof TRPCError && cause.code === "NOT_FOUND") {
      return error("Not found", 404)
    }
    throw cause
  }
}
