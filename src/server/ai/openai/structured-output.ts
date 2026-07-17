import { toJSONSchema, type ZodType } from "zod"

import { AiActionError } from "../errors"
import type { InputImage } from "../types"
import { requestWithRetry } from "./http"

const CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions"

export interface OpenAIActionConfig {
  token: string
  model: string
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

interface ChatResponse {
  choices?: {
    message?: { content?: string | null; refusal?: string | null }
  }[]
}

export async function generateStructuredOutput<T>(
  config: OpenAIActionConfig,
  input: {
    system: string
    user: string
    image?: InputImage
    schema: ZodType<T>
    schemaName: string
  }
): Promise<T> {
  const messages: ChatMessage[] = [
    { role: "system", content: input.system },
    {
      role: "user",
      content: input.image
        ? [
            { type: "text", text: input.user },
            {
              type: "image_url",
              image_url: {
                url: `data:${input.image.mediaType};base64,${input.image.data.toString("base64")}`,
                detail: "high",
              },
            },
          ]
        : input.user,
    },
  ]
  const response = await requestWithRetry([
    CHAT_COMPLETIONS_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: input.schemaName,
            strict: true,
            schema: toJSONSchema(input.schema),
          },
        },
      }),
    },
  ])
  const payload = (await response.json()) as ChatResponse
  const message = payload.choices?.[0]?.message
  if (message?.refusal) {
    throw new AiActionError("content_rejected")
  }
  if (!message?.content) {
    throw new AiActionError("invalid_response")
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(message.content)
  } catch (error) {
    throw new AiActionError("invalid_response", { cause: error })
  }
  const result = input.schema.safeParse(parsed)
  if (!result.success) {
    throw new AiActionError("invalid_response", { cause: result.error })
  }
  return result.data
}
