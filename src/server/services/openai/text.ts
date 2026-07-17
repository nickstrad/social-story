import { toJSONSchema, type ZodType } from "zod"

import type { Config } from "../../config"
import type { TextGenerator } from "../../ports/text"
import { requestWithRetry } from "./http"

const CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions"

type OpenAIConfig = Config["openai"]

interface ChatResponse {
  choices?: { message?: { content?: string | null } }[]
}

type ChatMessage =
  | { role: "system"; content: string }
  | {
      role: "user"
      content:
        | string
        | Array<
            | { type: "text"; text: string }
            | {
                type: "image_url"
                image_url: { url: string; detail: "high" }
              }
          >
    }

interface JsonRequest<T> {
  schema: ZodType<T>
  schemaName?: string
  messages: ChatMessage[]
}

function parseAndValidate<T>(content: string, schema: ZodType<T>): T {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch (error) {
    throw new Error("OpenAI returned invalid JSON", { cause: error })
  }

  const result = schema.safeParse(parsed)
  if (!result.success) {
    throw new Error(
      `OpenAI response did not match the requested schema: ${result.error.message}`
    )
  }
  return result.data
}

export function openAITextGenerator(config: OpenAIConfig): TextGenerator {
  async function requestJson<T>({
    schema,
    schemaName = "response",
    messages,
  }: JsonRequest<T>): Promise<T> {
    const response = await requestWithRetry([
      CHAT_COMPLETIONS_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.chatModel,
          messages,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: schemaName,
              strict: true,
              schema: toJSONSchema(schema),
            },
          },
        }),
      },
    ])
    const payload = (await response.json()) as ChatResponse
    const content = payload.choices?.[0]?.message?.content
    if (!content)
      throw new Error("OpenAI response contained no message content")
    return parseAndValidate(content, schema)
  }

  return {
    generateJson: ({ system, user, schema, schemaName }) =>
      requestJson({
        schema,
        schemaName,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    generateJsonWithImage: ({ system, user, image, schema, schemaName }) =>
      requestJson({
        schema,
        schemaName,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: user },
              {
                type: "image_url",
                image_url: {
                  url: `data:${image.mimeType};base64,${image.data.toString("base64")}`,
                  detail: "high",
                },
              },
            ],
          },
        ],
      }),
  }
}
