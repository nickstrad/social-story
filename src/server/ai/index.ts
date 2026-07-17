export { AiActionError, type AiActionErrorCode } from "./errors"
export {
  characterPhotoAutofillSchema,
  type CharacterPhotoAutofill,
  type CharacterPhotoSuggestion,
} from "./ports/character-photo-autofill"
export type { BaseImageGenerator } from "./ports/base-image"
export type { CoverImageGenerator } from "./ports/cover-image"
export type { PageImageGenerator } from "./ports/page-image"
export type { StoryToData } from "./ports/story-to-data"
export type {
  CharacterContext,
  CharacterPhotoReference,
  GeneratedArtwork,
  ImageDimensions,
  InputImage,
  RuleContext,
} from "./types"
export { toCharacterContext, toRuleContext } from "./types"

import type { BaseImageGenerator } from "./ports/base-image"
import type { CharacterPhotoAutofill } from "./ports/character-photo-autofill"
import type { CoverImageGenerator } from "./ports/cover-image"
import type { PageImageGenerator } from "./ports/page-image"
import type { StoryToData } from "./ports/story-to-data"

export interface AiActions {
  storyToData: StoryToData
  characterPhotoAutofill: CharacterPhotoAutofill
  baseImage: BaseImageGenerator
  pageImage: PageImageGenerator
  coverImage: CoverImageGenerator
}
