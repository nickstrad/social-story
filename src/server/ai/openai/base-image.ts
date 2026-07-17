import type { BaseImageGenerator } from "../ports/base-image"
import { buildBaseSheetPrompt } from "../prompts/illustration"
import { runOpenAIAction } from "./errors"
import { generateImage } from "./image-generation"
import type { OpenAIActionConfig } from "./structured-output"

export function openAIBaseImage(
  config: OpenAIActionConfig
): BaseImageGenerator {
  return {
    generate: (input) =>
      runOpenAIAction(async () => {
        const promptUsed = buildBaseSheetPrompt(input.characters)
        // OpenAI's edit transport accepts positional image parts; labels remain
        // in the port so providers with named inputs can use them unchanged.
        const png = await generateImage(config, {
          prompt: promptUsed,
          references: input.photos.map(({ photo }) => photo),
          dimensions: input.dimensions,
        })
        return { png, promptUsed }
      }),
  }
}
