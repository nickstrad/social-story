import { del, get, put } from "@vercel/blob"

import type { Storage } from "../ports/storage"

export type BlobCredentials =
  { storeId: string; oidcToken: string } | { token: string }

export function createVercelBlobStorage(credentials: BlobCredentials): Storage {
  const read: Storage["read"] = async (locator, ifNoneMatch) => {
    const result = await get(locator, {
      access: "private",
      ifNoneMatch,
      ...credentials,
    })
    if (!result) return { status: 404 }
    if (result.statusCode === 304) {
      return { status: 304, etag: result.blob.etag }
    }
    return {
      status: 200,
      stream: result.stream,
      contentType: result.blob.contentType,
      byteLength: result.blob.size,
      etag: result.blob.etag,
    }
  }
  return {
    async put(key, data, contentType) {
      const result = await put(key, data, {
        access: "private",
        addRandomSuffix: true,
        contentType,
        ...credentials,
      })
      return { locator: result.pathname }
    },
    read,
    async fetchBuffer(locator) {
      const result = await read(locator)
      if (result.status !== 200) throw new Error(`Blob not found: ${locator}`)
      return Buffer.from(await new Response(result.stream).arrayBuffer())
    },
    async delete(locator) {
      await del(locator, credentials)
    },
  }
}
