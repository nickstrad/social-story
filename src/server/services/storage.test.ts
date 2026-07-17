import { describe, expect, it } from "vitest"

import { inMemoryStorage } from "./memory-storage"
import {
  baseImageKey,
  pageImageKey,
  photoKey,
  storyPdfKey,
} from "./storage-keys"

describe("inMemoryStorage", () => {
  it("puts, fetches, and deletes a blob", async () => {
    const storage = inMemoryStorage()
    const { locator } = await storage.put(
      "hello.txt",
      Buffer.from("hello"),
      "text/plain"
    )

    const first = await storage.read(locator)
    expect(first.status).toBe(200)
    const etag = first.status === 200 ? first.etag : ""
    await expect(storage.read(locator, etag)).resolves.toEqual({
      status: 304,
      etag,
    })
    await expect(storage.fetchBuffer(locator)).resolves.toEqual(
      Buffer.from("hello")
    )
    await storage.delete(locator)
    await expect(storage.read(locator)).resolves.toEqual({ status: 404 })
    await expect(storage.fetchBuffer(locator)).rejects.toThrow("Blob not found")
  })
})

describe("storage keys", () => {
  it("builds every documented key", () => {
    expect(photoKey("story", "character")).toBe(
      "stories/story/photos/character.png"
    )
    expect(baseImageKey("story")).toBe("stories/story/base.png")
    expect(pageImageKey("story", "page", 3)).toBe(
      "stories/story/pages/page/v3.png"
    )
    expect(storyPdfKey("story")).toBe("stories/story/story.pdf")
  })
})
