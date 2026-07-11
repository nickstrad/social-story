import type { Storage } from "../ports/storage"
import { toBuffer } from "./memory-storage"

// In-memory blob store for Playwright E2E. Unlike `inMemoryStorage`, its URLs
// are same-origin paths (`/api/test-storage/<key>`) so `next/image` and the
// browser can actually fetch stored photos and generated sheets without a real
// blob host. The store lives at module scope so the storage adapter (built in
// the container) and the read-only route handler share the same bytes within a
// single server process.
interface StoredBlob {
  bytes: Buffer
  contentType: string
}

const store = new Map<string, StoredBlob>()

const PREFIX = "/api/test-storage/"

const keyFromUrl = (url: string) =>
  url.startsWith(PREFIX) ? url.slice(PREFIX.length) : url

export function e2eStorage(): Storage {
  return {
    async put(key, data, contentType) {
      store.set(key, { bytes: await toBuffer(data), contentType })
      return { url: `${PREFIX}${key}` }
    },
    async fetchBuffer(url) {
      const value = store.get(keyFromUrl(url))
      if (!value) throw new Error(`Blob not found: ${url}`)
      return Buffer.from(value.bytes)
    },
    async delete(url) {
      store.delete(keyFromUrl(url))
    },
  }
}

/** Read raw bytes for a storage key, used by the test-storage route handler. */
export function readE2eBlob(key: string): StoredBlob | undefined {
  const value = store.get(key)
  return value
    ? { bytes: Buffer.from(value.bytes), contentType: value.contentType }
    : undefined
}
