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
    const { url } = await storage.put(
      "hello.txt",
      Buffer.from("hello"),
      "text/plain"
    )

    await expect(storage.fetchBuffer(url)).resolves.toEqual(
      Buffer.from("hello")
    )
    await storage.delete(url)
    await expect(storage.fetchBuffer(url)).rejects.toThrow("Blob not found")
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
