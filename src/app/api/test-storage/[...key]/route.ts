import { getConfig } from "@/server/config"
import { readE2eBlob } from "@/server/services/e2e-storage"

// Serves blobs held by the E2E in-memory storage so the browser (and the
// next/image optimizer) can load faked photos and generated sheets. Mounted
// only in fake mode — a 404 otherwise keeps it inert in real deployments.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  if (!getConfig().e2eFakes) {
    return new Response("Not found", { status: 404 })
  }

  const { key } = await params
  const blob = readE2eBlob(key.join("/"))
  if (!blob) return new Response("Not found", { status: 404 })

  return new Response(new Uint8Array(blob.bytes), {
    headers: { "Content-Type": blob.contentType, "Cache-Control": "no-store" },
  })
}
