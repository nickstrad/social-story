import type { CoverImageGenerator } from "../ports/cover-image"
import { buildCoverPrompt } from "../prompts/illustration"
import { runOpenAIAction } from "./errors"
import { generateImage } from "./image-generation"
import type { OpenAIActionConfig } from "./structured-output"

export function openAICoverImage(
  config: OpenAIActionConfig
): CoverImageGenerator {
  return {
    generate: (input) =>
      runOpenAIAction(async () => {
        const promptUsed = buildCoverPrompt({
          title: input.title,
          characters: input.cast,
          note: input.note,
        })
        const references = [
          ...(input.anchorImage ? [input.anchorImage] : []),
          ...(input.characterPhoto ? [input.characterPhoto] : []),
        ]
        const png = await generateImage(config, {
          prompt: promptUsed,
          references,
          dimensions: input.dimensions,
        })
        return { png, promptUsed }
      }),
  }
}
