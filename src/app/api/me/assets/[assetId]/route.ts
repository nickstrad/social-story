import { getServerSession } from "@/server/auth-session"
import { getDeps } from "@/server/container"
import { BROWSER_ASSET_KINDS } from "@/server/services/assets"

const notFound = () => new Response("Not found", { status: 404 })

const safeFilename = (filename: string | null) => {
  const sanitized = (filename ?? "story.pdf")
    .replace(/[\r\n"\\/]/g, "_")
    .replace(/[^\x20-\x7E]/g, "_")
    .slice(0, 180)
  return sanitized || "story.pdf"
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const session = await getServerSession(request.headers)
  if (!session) return new Response("Unauthorized", { status: 401 })

  const { assetId } = await params
  const deps = getDeps()
  const asset = await deps.repos.assets.getOwnedById(
    assetId,
    session.user.id,
    BROWSER_ASSET_KINDS
  )
  if (!asset) return notFound()

  const result = await deps.storage.read(
    asset.storageLocator,
    request.headers.get("if-none-match") ?? undefined
  )
  if (result.status === 404) return notFound()
  if (result.status === 304) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: result.etag,
        "Cache-Control": "private, no-cache",
        Vary: "Cookie",
      },
    })
  }

  const headers = new Headers({
    "Content-Type": asset.contentType,
    "Content-Length": String(asset.byteLength),
    ETag: result.etag,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-cache",
    Vary: "Cookie",
  })
  if (asset.kind === "PDF") {
    headers.set(
      "Content-Disposition",
      `attachment; filename="${safeFilename(asset.filename)}"`
    )
  } else {
    headers.set("Content-Disposition", "inline")
  }
  return new Response(result.stream, { headers })
}
