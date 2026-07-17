import type {
  CharacterContext,
  CharacterPhotoReference,
  GeneratedArtwork,
  ImageDimensions,
} from "../types"

export interface BaseImageGenerator {
  generate(input: {
    characters: readonly CharacterContext[]
    photos: readonly CharacterPhotoReference[]
    dimensions: ImageDimensions
  }): Promise<GeneratedArtwork>
}
