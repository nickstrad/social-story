export interface ReferenceImage {
  data: Buffer
  mimeType: string
}

export interface ImageGenerator {
  generate(args: {
    prompt: string
    referenceImages?: ReferenceImage[]
    width: number
    height: number
  }): Promise<Buffer>
}
