import type { Storage } from "../ports/storage"
import { createMemoryStorage, type StoredBlob } from "./memory-storage"

// Process-wide in-memory private store for Playwright. Browser reads still pass
// through the authenticated asset route; locators never become URLs.
const store = new Map<string, StoredBlob>()

export function e2eStorage(): Storage {
  return createMemoryStorage(store, (key) => `${key}-${crypto.randomUUID()}`)
}
