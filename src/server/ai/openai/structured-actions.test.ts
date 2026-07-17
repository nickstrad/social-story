// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest"

import { AiActionError } from "../errors"
import { openAICharacterPhotoAutofill } from "./character-photo-autofill"
import { openAIStoryToData } from "./story-to-data"

function chatResponse(content: unknown) {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(content) } }],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("OpenAI structured action adapters", () => {
  it("builds and validates the story-to-data request with its configured model", async () => {
    const parsed = {
      title: "A Calm Visit",
      pages: [
        {
          page: 1,
          text: "We arrive.",
          imagePrompt: "A quiet lobby",
          characterNames: [],
        },
      ],
    }
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(chatResponse(parsed))
    vi.stubGlobal("fetch", fetchMock)

    const result = await openAIStoryToData({
      token: "secret",
      model: "story-model",
    }).convert({ script: "Private story", characters: [], rules: [] })

    expect(result).toEqual(parsed)
    const [, init] = fetchMock.mock.calls[0]
    const body = JSON.parse(String(init?.body))
    expect(body.model).toBe("story-model")
    expect(body.messages[1]).toEqual({ role: "user", content: "Private story" })
    expect(body.response_format).toMatchObject({
      type: "json_schema",
      json_schema: { name: "story_pages", strict: true },
    })
  })

  it("sends the photo with the visible-details safety policy and exact schema", async () => {
    const suggestion = {
      appearance: "Short dark hair",
      photoDescription: "A person smiling outdoors",
    }
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(chatResponse(suggestion))
    vi.stubGlobal("fetch", fetchMock)

    await openAICharacterPhotoAutofill({
      token: "secret",
      model: "vision-model",
    }).suggest({
      photo: { data: Buffer.from("photo-bytes"), mediaType: "image/png" },
    })

    const [, init] = fetchMock.mock.calls[0]
    const body = JSON.parse(String(init?.body))
    expect(body.model).toBe("vision-model")
    expect(body.messages[0].content).toContain("Do not identify the person")
    expect(body.messages[1].content[1].image_url.url).toBe(
      `data:image/png;base64,${Buffer.from("photo-bytes").toString("base64")}`
    )
    expect(body.response_format.json_schema.schema.properties).toHaveProperty(
      "appearance"
    )
    expect(body.response_format.json_schema.schema.properties).toHaveProperty(
      "photoDescription"
    )
  })

  it.each([
    [
      "refusal",
      { choices: [{ message: { refusal: "no" } }] },
      "content_rejected",
    ],
    [
      "malformed JSON",
      { choices: [{ message: { content: "{" } }] },
      "invalid_response",
    ],
    [
      "invalid schema",
      { choices: [{ message: { content: "{}" } }] },
      "invalid_response",
    ],
  ] as const)("maps %s to a safe action error", async (_, payload, code) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(payload), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
      )
    )

    const promise = openAICharacterPhotoAutofill({
      token: "secret",
      model: "vision-model",
    }).suggest({ photo: { data: Buffer.from("x"), mediaType: "image/png" } })

    await expect(promise).rejects.toMatchObject({
      name: "AiActionError",
      code,
    } satisfies Partial<AiActionError>)
  })
})
