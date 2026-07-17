// @vitest-environment node

import sharp from "sharp"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { InputImage } from "../types"
import { openAIBaseImage } from "./base-image"
import { openAICoverImage } from "./cover-image"
import { openAIPageImage } from "./page-image"

async function png(r = 10): Promise<Buffer> {
  return sharp({
    create: {
      width: 2,
      height: 2,
      channels: 4,
      background: { r, g: 20, b: 30, alpha: 1 },
    },
  })
    .png()
    .toBuffer()
}

async function imageResponse() {
  return new Response(
    JSON.stringify({ data: [{ b64_json: (await png()).toString("base64") }] }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  )
}

const dimensions = { width: 1024, height: 1024 }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("OpenAI image action adapters", () => {
  it("uses each action model, returns PNG and preserves its exact prompt", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => imageResponse())
    vi.stubGlobal("fetch", fetchMock)

    const base = await openAIBaseImage({
      token: "t",
      model: "base-model",
    }).generate({
      characters: [{ name: "Ava", role: null, age: null, appearance: null }],
      photos: [],
      dimensions,
    })
    const page = await openAIPageImage({
      token: "t",
      model: "page-model",
    }).generate({
      scene: "A quiet park",
      pageCharacters: [],
      cast: [],
      rules: [],
      dimensions,
    })
    const cover = await openAICoverImage({
      token: "t",
      model: "cover-model",
    }).generate({
      title: "A Calm Day",
      cast: [],
      dimensions,
    })

    expect(
      [base, page, cover].every(
        ({ png }) => png.subarray(1, 4).toString() === "PNG"
      )
    ).toBe(true)
    const bodies = fetchMock.mock.calls.map(([, init]) =>
      JSON.parse(String(init?.body))
    )
    expect(bodies.map(({ model }) => model)).toEqual([
      "base-model",
      "page-model",
      "cover-model",
    ])
    expect(bodies.map(({ response_format }) => response_format)).toEqual([
      undefined,
      undefined,
      undefined,
    ])
    expect(bodies.map(({ prompt }) => prompt)).toEqual([
      base.promptUsed,
      page.promptUsed,
      cover.promptUsed,
    ])
    expect(base.promptUsed).toContain("CHARACTER REFERENCE SHEET")
    expect(page.promptUsed).toContain("A quiet park")
    expect(cover.promptUsed).toContain("A Calm Day")
  })

  it("orders anchor before photo for page and cover edit requests", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => imageResponse())
    vi.stubGlobal("fetch", fetchMock)
    const anchor: InputImage = { data: await png(1), mediaType: "image/png" }
    const photo: InputImage = { data: await png(2), mediaType: "image/png" }

    await openAIPageImage({ token: "t", model: "page-model" }).generate({
      scene: "A bus stop",
      pageCharacters: [
        { name: "Ava", role: null, age: null, appearance: null },
      ],
      cast: [{ name: "Ava", role: null, age: null, appearance: null }],
      rules: [],
      anchorImage: anchor,
      characterPhoto: photo,
      dimensions,
    })
    await openAICoverImage({ token: "t", model: "cover-model" }).generate({
      title: "The Bus",
      cast: [{ name: "Ava", role: null, age: null, appearance: null }],
      anchorImage: anchor,
      characterPhoto: photo,
      dimensions,
    })

    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.body).toBeInstanceOf(FormData)
      const form = init?.body as FormData
      expect(form.get("response_format")).toBeNull()
      expect(form.get("model")).toMatch(/^(page|cover)-model$/)
      const images = form.getAll("image[]") as File[]
      expect(images.map(({ name }) => name)).toEqual([
        "reference-0.png",
        "reference-1.png",
      ])
      expect(
        Buffer.from(await images[0].arrayBuffer()).equals(anchor.data)
      ).toBe(true)
      expect(
        Buffer.from(await images[1].arrayBuffer()).equals(photo.data)
      ).toBe(true)
    }
  })

  it("maps missing image data and invalid dimensions to safe errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ data: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
      )
    )
    const action = openAIBaseImage({ token: "t", model: "base-model" })
    await expect(
      action.generate({ characters: [], photos: [], dimensions })
    ).rejects.toMatchObject({ code: "invalid_response" })
    await expect(
      action.generate({
        characters: [],
        photos: [],
        dimensions: { width: 0, height: 1024 },
      })
    ).rejects.toMatchObject({ code: "invalid_input" })
  })
})
