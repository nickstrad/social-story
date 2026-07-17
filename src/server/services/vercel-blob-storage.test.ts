import { beforeEach, describe, expect, it, vi } from "vitest"

const blob = vi.hoisted(() => ({
  put: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
}))

vi.mock("@vercel/blob", () => blob)

import { createVercelBlobStorage } from "./vercel-blob-storage"

describe("private Vercel Blob storage", () => {
  beforeEach(() => vi.clearAllMocks())

  it("uses private immutable writes and passes only OIDC credentials", async () => {
    blob.put.mockResolvedValue({ pathname: "stories/x/file-random.png" })
    const storage = createVercelBlobStorage({
      storeId: "store",
      oidcToken: "oidc",
    })
    await expect(
      storage.put("stories/x/file.png", Buffer.from("x"), "image/png")
    ).resolves.toEqual({ locator: "stories/x/file-random.png" })
    expect(blob.put).toHaveBeenCalledWith(
      "stories/x/file.png",
      expect.any(Buffer),
      expect.objectContaining({
        access: "private",
        addRandomSuffix: true,
        storeId: "store",
        oidcToken: "oidc",
      })
    )
    expect(blob.put.mock.calls[0][2]).not.toHaveProperty("token")
  })

  it("maps 200, 304, and missing reads and forwards the ETag", async () => {
    const storage = createVercelBlobStorage({ token: "local" })
    const stream = new ReadableStream<Uint8Array>()
    blob.get.mockResolvedValueOnce({
      statusCode: 200,
      stream,
      blob: { contentType: "image/png", size: 12, etag: '"etag"' },
    })
    await expect(storage.read("private/image", '"old"')).resolves.toEqual({
      status: 200,
      stream,
      contentType: "image/png",
      byteLength: 12,
      etag: '"etag"',
    })
    expect(blob.get).toHaveBeenCalledWith(
      "private/image",
      expect.objectContaining({
        access: "private",
        ifNoneMatch: '"old"',
        token: "local",
      })
    )
    blob.get.mockResolvedValueOnce({
      statusCode: 304,
      blob: { etag: '"etag"' },
    })
    await expect(storage.read("private/image", '"etag"')).resolves.toEqual({
      status: 304,
      etag: '"etag"',
    })
    blob.get.mockResolvedValueOnce(null)
    await expect(storage.read("private/missing")).resolves.toEqual({
      status: 404,
    })
  })

  it("authenticates delete with the selected credentials", async () => {
    const storage = createVercelBlobStorage({ token: "local" })
    await storage.delete("private/image")
    expect(blob.del).toHaveBeenCalledWith("private/image", { token: "local" })
  })
})
