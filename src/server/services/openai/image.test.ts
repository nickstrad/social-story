// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest"

import { openAIImageGenerator } from "./image"

const config = { token: "token", chatModel: "chat", imageModel: "image" }
const encoded = Buffer.from("png bytes").toString("base64")

describe("openAIImageGenerator", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("uses generations for a prompt without references", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ data: [{ b64_json: encoded }] }))
    vi.stubGlobal("fetch", fetchMock)

    const result = await openAIImageGenerator(config).generate({
      prompt: "scene",
      width: 1024,
      height: 1024,
    })

    expect(result.toString()).toBe("png bytes")
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/images/generations")
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body.size).toBe("1024x1024")
    expect(body).not.toHaveProperty("response_format")
  })

  it("uses repeated image fields for edits and preserves MIME types", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ data: [{ b64_json: encoded }] }))
    vi.stubGlobal("fetch", fetchMock)

    await openAIImageGenerator(config).generate({
      prompt: "scene",
      width: 1024,
      height: 1536,
      referenceImages: [
        { data: Buffer.from("one"), mimeType: "image/png" },
        { data: Buffer.from("two"), mimeType: "image/jpeg" },
      ],
    })

    expect(fetchMock.mock.calls[0]?.[0]).toContain("/images/edits")
    const body = fetchMock.mock.calls[0]?.[1]?.body as FormData
    const images = body.getAll("image[]") as File[]
    expect(images).toHaveLength(2)
    expect(images.map((image) => image.type)).toEqual([
      "image/png",
      "image/jpeg",
    ])
    expect(body.get("size")).toBe("1024x1536")
    expect(body.has("response_format")).toBe(false)
  })
})
