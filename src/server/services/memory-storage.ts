import type { Storage } from "../ports/storage"

export interface StoredBlob {
  bytes: Buffer
  contentType: string
  etag: string
}

export async function toBuffer(data: Buffer | ReadableStream): Promise<Buffer> {
  if (Buffer.isBuffer(data)) return Buffer.from(data)
  return Buffer.from(await new Response(data).arrayBuffer())
}

export function createMemoryStorage(
  blobs: Map<string, StoredBlob>,
  locatorFor: (key: string, bytes: Buffer) => string
): Storage {
  const read: Storage["read"] = async (locator, ifNoneMatch) => {
    const value = blobs.get(locator)
    if (!value) return { status: 404 }
    if (ifNoneMatch === value.etag) return { status: 304, etag: value.etag }
    const bytes = Buffer.from(value.bytes)
    return {
      status: 200,
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(bytes)
          controller.close()
        },
      }),
      contentType: value.contentType,
      byteLength: bytes.length,
      etag: value.etag,
    }
  }
  const fetchBuffer: Storage["fetchBuffer"] = async (locator) => {
    const result = await read(locator)
    if (result.status !== 200) throw new Error(`Blob not found: ${locator}`)
    return Buffer.from(await new Response(result.stream).arrayBuffer())
  }
  return {
    async put(key, data, contentType) {
      const bytes = await toBuffer(data)
      const locator = locatorFor(key, bytes)
      blobs.set(locator, {
        bytes,
        contentType,
        etag: `"${locator}"`,
      })
      return { locator }
    },
    read,
    fetchBuffer,
    async delete(locator) {
      blobs.delete(locator)
    },
  }
}

export function inMemoryStorage(): Storage {
  let suffix = 0
  return createMemoryStorage(
    new Map(),
    (key) => `mem://${encodeURIComponent(key)}-${suffix++}`
  )
}
