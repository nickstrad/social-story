import sharp from "sharp"

import type { ImageGenerator } from "../ports/image"
import type { TextGenerator } from "../ports/text"
import type { TaskDispatcher } from "../ports/dispatcher"

export function immediateDispatcher(
  runner: (taskId: string) => Promise<void>
): TaskDispatcher {
  return { dispatch: runner }
}

export function fakeTextGenerator(
  cannedByPrompt: Readonly<Record<string, unknown>>
): TextGenerator {
  return {
    async generateJson({ user, schema }) {
      if (!(user in cannedByPrompt)) {
        throw new Error(`No canned text response for prompt: ${user}`)
      }
      return schema.parse(cannedByPrompt[user])
    },
  }
}

// Prompt-agnostic variant for E2E: returns the same canned value for any prompt,
// validated against the caller's schema. PARSE_STORY is the only text task, so a
// single fixture suffices; the schema.parse guards against fixture/schema drift.
export function staticTextGenerator(canned: unknown): TextGenerator {
  return {
    async generateJson({ schema }) {
      return schema.parse(canned)
    },
  }
}

/** Prompt-aware file response for deterministic E2E service simulation. */
export function scriptedImageGenerator(
  responseForPrompt: (prompt: string) => Buffer
): ImageGenerator {
  return {
    async generate({ prompt }) {
      return Buffer.from(responseForPrompt(prompt))
    },
  }
}

let tinyPng: Promise<Buffer> | undefined

export function fakeImageGenerator(): ImageGenerator {
  return {
    async generate() {
      tinyPng ??= sharp({
        create: {
          width: 4,
          height: 4,
          channels: 4,
          background: { r: 234, g: 226, b: 246, alpha: 1 },
        },
      })
        .png()
        .toBuffer()
      return Buffer.from(await tinyPng)
    },
  }
}
