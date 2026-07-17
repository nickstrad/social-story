import { z } from "zod"

import type { InputImage } from "../types"

const requiredText = z.string().trim().min(1)

export const characterPhotoAutofillSchema = z
  .object({
    appearance: requiredText.max(2_000),
    photoDescription: requiredText.max(2_000),
  })
  .strict()

export type CharacterPhotoSuggestion = z.infer<
  typeof characterPhotoAutofillSchema
>

export interface CharacterPhotoAutofill {
  suggest(input: { photo: InputImage }): Promise<CharacterPhotoSuggestion>
}
