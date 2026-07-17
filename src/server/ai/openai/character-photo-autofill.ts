import type { CharacterPhotoAutofill } from "../ports/character-photo-autofill"
import { characterPhotoAutofillSchema } from "../ports/character-photo-autofill"
import {
  CHARACTER_PHOTO_AUTOFILL_SYSTEM_PROMPT,
  CHARACTER_PHOTO_AUTOFILL_USER_PROMPT,
} from "../prompts/character-photo-autofill"
import { runOpenAIAction } from "./errors"
import {
  generateStructuredOutput,
  type OpenAIActionConfig,
} from "./structured-output"

export function openAICharacterPhotoAutofill(
  config: OpenAIActionConfig
): CharacterPhotoAutofill {
  return {
    suggest: ({ photo }) =>
      runOpenAIAction(() =>
        generateStructuredOutput(config, {
          system: CHARACTER_PHOTO_AUTOFILL_SYSTEM_PROMPT,
          user: CHARACTER_PHOTO_AUTOFILL_USER_PROMPT,
          image: photo,
          schema: characterPhotoAutofillSchema,
          schemaName: "character_photo_details",
        })
      ),
  }
}
