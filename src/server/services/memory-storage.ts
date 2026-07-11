import type { Storage } from "../ports/storage"

export async function toBuffer(data: Buffer | ReadableStream): Promise<Buffer> {
  if (Buffer.isBuffer(data)) return Buffer.from(data)
  return Buffer.from(await new Response(data).arrayBuffer())
}

export function inMemoryStorage(): Storage {
  const blobs = new Map<string, Buffer>()
  let suffix = 0

  return {
    async put(key, data) {
      const url = `mem://${encodeURIComponent(key)}-${suffix++}`
      blobs.set(url, await toBuffer(data))
      return { url }
    },
    async fetchBuffer(url) {
      const value = blobs.get(url)
      if (!value) throw new Error(`Blob not found: ${url}`)
      return Buffer.from(value)
    },
    async delete(url) {
      blobs.delete(url)
    },
  }
}
