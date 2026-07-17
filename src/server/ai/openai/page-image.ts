import type { PageImageGenerator } from "../ports/page-image"
import { buildImagePrompt } from "../prompts/illustration"
import { runOpenAIAction } from "./errors"
import { generateImage } from "./image-generation"
import type { OpenAIActionConfig } from "./structured-output"

export function openAIPageImage(
  config: OpenAIActionConfig
): PageImageGenerator {
  return {
    generate: (input) =>
      runOpenAIAction(async () => {
        const promptUsed = buildImagePrompt({
          scene: input.scene,
          characters: input.pageCharacters,
          allCharacters: input.cast,
          anchored: Boolean(input.anchorImage),
          steeringText: input.steeringText,
          rules: input.rules,
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
