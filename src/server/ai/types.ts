import type { RuleKind } from "@/server/domain/types"

export interface InputImage {
  data: Buffer
  mediaType: string
}

export interface ImageDimensions {
  width: number
  height: number
}

export interface CharacterContext {
  name: string
  role: string | null
  age: string | null
  appearance: string | null
}

export interface RuleContext {
  kind: RuleKind
  text: string
}

export interface CharacterPhotoReference {
  characterName: string
  photo: InputImage
}

export interface GeneratedArtwork {
  png: Buffer
  promptUsed: string
}

export function toCharacterContext({
  name,
  role,
  age,
  appearance,
}: CharacterContext): CharacterContext {
  return { name, role, age, appearance }
}

export function toRuleContext({ kind, text }: RuleContext): RuleContext {
  return { kind, text }
}
