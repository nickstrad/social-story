import sharp from "sharp"

import { AiActionError } from "../errors"
import type { ImageDimensions, InputImage } from "../types"
import { requestWithRetry } from "./http"
import type { OpenAIActionConfig } from "./structured-output"

const API_ROOT = "https://api.openai.com/v1/images"

interface ImageResponse {
  data?: { b64_json?: string }[]
}

function size({ width, height }: ImageDimensions): string {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new AiActionError("invalid_input")
  }
  return `${width}x${height}`
}

function extensionFor(mediaType: string): string {
  return mediaType.split("/")[1]?.replace("jpeg", "jpg") || "png"
}

function editBody(
  config: OpenAIActionConfig,
  prompt: string,
  images: readonly InputImage[],
  imageSize: string
): FormData {
  const body = new FormData()
  body.set("model", config.model)
  body.set("prompt", prompt)
  body.set("size", imageSize)
  images.forEach((image, index) => {
    const blob = new Blob([new Uint8Array(image.data)], {
      type: image.mediaType,
    })
    body.append(
      "image[]",
      blob,
      `reference-${index}.${extensionFor(image.mediaType)}`
    )
  })
  return body
}

async function decodePng(response: Response): Promise<Buffer> {
  const payload = (await response.json()) as ImageResponse
  const encoded = payload.data?.[0]?.b64_json
  if (!encoded) throw new AiActionError("invalid_response")
  const data = Buffer.from(encoded, "base64")
  try {
    const metadata = await sharp(data).metadata()
    return metadata.format === "png" ? data : sharp(data).png().toBuffer()
  } catch (error) {
    throw new AiActionError("invalid_response", { cause: error })
  }
}

export async function generateImage(
  config: OpenAIActionConfig,
  input: {
    prompt: string
    references?: readonly InputImage[]
    dimensions: ImageDimensions
  }
): Promise<Buffer> {
  const imageSize = size(input.dimensions)
  const references = input.references ?? []
  const authorization = { Authorization: `Bearer ${config.token}` }

  if (references.length > 0) {
    return decodePng(
      await requestWithRetry([
        `${API_ROOT}/edits`,
        {
          method: "POST",
          headers: authorization,
          body: editBody(config, input.prompt, references, imageSize),
        },
      ])
    )
  }

  return decodePng(
    await requestWithRetry([
      `${API_ROOT}/generations`,
      {
        method: "POST",
        headers: { ...authorization, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.model,
          prompt: input.prompt,
          size: imageSize,
        }),
      },
    ])
  )
}
