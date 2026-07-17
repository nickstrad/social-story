import type { Config } from "../../config"
import type { ImageGenerator, ReferenceImage } from "../../ports/image"
import { requestWithRetry } from "./http"

const API_ROOT = "https://api.openai.com/v1/images"
type OpenAIConfig = Config["openai"]

interface ImageResponse {
  data?: { b64_json?: string }[]
}

function size(width: number, height: number): string {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error("Image width and height must be positive integers")
  }
  return `${width}x${height}`
}

function extensionFor(mimeType: string): string {
  return mimeType.split("/")[1]?.replace("jpeg", "jpg") || "png"
}

function editBody(
  config: OpenAIConfig,
  prompt: string,
  images: ReferenceImage[],
  imageSize: string
): FormData {
  const body = new FormData()
  body.set("model", config.imageModel)
  body.set("prompt", prompt)
  body.set("size", imageSize)
  images.forEach((image, index) => {
    const blob = new Blob([new Uint8Array(image.data)], {
      type: image.mimeType,
    })
    body.append(
      "image[]",
      blob,
      `reference-${index}.${extensionFor(image.mimeType)}`
    )
  })
  return body
}

async function decodeImage(response: Response): Promise<Buffer> {
  const payload = (await response.json()) as ImageResponse
  const encoded = payload.data?.[0]?.b64_json
  if (!encoded) throw new Error("OpenAI response contained no image data")
  return Buffer.from(encoded, "base64")
}

export function openAIImageGenerator(config: OpenAIConfig): ImageGenerator {
  return {
    async generate({ prompt, referenceImages = [], width, height }) {
      const imageSize = size(width, height)
      const headers = { Authorization: `Bearer ${config.token}` }

      if (referenceImages.length > 0) {
        const response = await requestWithRetry([
          `${API_ROOT}/edits`,
          {
            method: "POST",
            headers,
            body: editBody(config, prompt, referenceImages, imageSize),
          },
        ])
        return decodeImage(response)
      }

      const response = await requestWithRetry([
        `${API_ROOT}/generations`,
        {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: config.imageModel,
            prompt,
            size: imageSize,
          }),
        },
      ])
      return decodeImage(response)
    },
  }
}
