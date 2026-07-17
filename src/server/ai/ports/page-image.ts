import type {
  CharacterContext,
  GeneratedArtwork,
  ImageDimensions,
  InputImage,
  RuleContext,
} from "../types"

export interface PageImageGenerator {
  generate(input: {
    scene: string
    pageCharacters: readonly CharacterContext[]
    cast: readonly CharacterContext[]
    rules: readonly RuleContext[]
    steeringText?: string
    anchorImage?: InputImage
    characterPhoto?: InputImage
    dimensions: ImageDimensions
  }): Promise<GeneratedArtwork>
}
