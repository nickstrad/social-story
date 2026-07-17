// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"

import { openAITextGenerator } from "./text"

const config = { token: "token", chatModel: "chat", imageModel: "image" }

describe("openAITextGenerator", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("sends a JSON schema and validates the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        choices: [{ message: { content: '{"answer":"yes"}' } }],
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await openAITextGenerator(config).generateJson({
      system: "system",
      user: "user",
      schema: z.object({ answer: z.string() }),
      schemaName: "answer",
    })

    expect(result).toEqual({ answer: "yes" })
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    const body = JSON.parse(String(init.body))
    const jsonSchema = body.response_format.json_schema.schema
    expect(jsonSchema.properties.answer.type).toBe("string")
    expect(jsonSchema.additionalProperties).toBe(false)
    expect(jsonSchema.required).toEqual(["answer"])
  })

  it("raises a descriptive error when validation fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ choices: [{ message: { content: '{"answer":1}' } }] })
        )
    )

    await expect(
      openAITextGenerator(config).generateJson({
        system: "system",
        user: "user",
        schema: z.object({ answer: z.string() }),
      })
    ).rejects.toThrow("did not match the requested schema")
  })

  it("sends an image data URL with a structured multimodal request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        choices: [
          {
            message: {
              content:
                '{"appearance":"dark hair","photoDescription":"outdoors"}',
            },
          },
        ],
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await openAITextGenerator(config).generateJsonWithImage({
      system: "family friendly",
      user: "describe visible details",
      image: { data: Buffer.from("photo"), mimeType: "image/png" },
      schema: z.object({
        appearance: z.string(),
        photoDescription: z.string(),
      }),
      schemaName: "photo_details",
    })

    expect(result.appearance).toBe("dark hair")
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    const body = JSON.parse(String(init.body))
    expect(body.messages[1].content).toEqual([
      { type: "text", text: "describe visible details" },
      {
        type: "image_url",
        image_url: {
          url: `data:image/png;base64,${Buffer.from("photo").toString("base64")}`,
          detail: "high",
        },
      },
    ])
    expect(body.response_format.json_schema.name).toBe("photo_details")
  })
})
