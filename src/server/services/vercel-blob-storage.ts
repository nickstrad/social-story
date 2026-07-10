import { del, put } from "@vercel/blob"

import type { Storage } from "../ports/storage"

export function createVercelBlobStorage(token: string): Storage {
  return {
    async put(key, data, contentType) {
      const result = await put(key, data, {
        access: "public",
        addRandomSuffix: true,
        contentType,
        token,
      })
      return { url: result.url }
    },
    async fetchBuffer(url) {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to fetch blob (${response.status}): ${url}`)
      }
      return Buffer.from(await response.arrayBuffer())
    },
    async delete(url) {
      await del(url, { token })
    },
  }
}
