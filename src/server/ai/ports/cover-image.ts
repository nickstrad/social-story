import type {
  CharacterContext,
  GeneratedArtwork,
  ImageDimensions,
  InputImage,
} from "../types"

export interface CoverImageGenerator {
  generate(input: {
    title: string
    cast: readonly CharacterContext[]
    note?: string
    anchorImage?: InputImage
    characterPhoto?: InputImage
    dimensions: ImageDimensions
  }): Promise<GeneratedArtwork>
}
