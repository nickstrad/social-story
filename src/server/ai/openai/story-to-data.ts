import { buildParsedStorySchema } from "@/server/domain/schemas"

import type { StoryToData } from "../ports/story-to-data"
import { buildParseSystemPrompt } from "../prompts/story-to-data"
import { runOpenAIAction } from "./errors"
import {
  generateStructuredOutput,
  type OpenAIActionConfig,
} from "./structured-output"

export function openAIStoryToData(config: OpenAIActionConfig): StoryToData {
  return {
    convert: (input) =>
      runOpenAIAction(() =>
        generateStructuredOutput(config, {
          system: buildParseSystemPrompt(input.characters, input.rules),
          user: input.script,
          schema: buildParsedStorySchema(
            input.characters.map(({ name }) => name)
          ),
          schemaName: "story_pages",
        })
      ),
  }
}
