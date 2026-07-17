import type { ZodType } from "zod"

export interface TextGenerator {
  generateJson<T>(args: {
    system: string
    user: string
    schema: ZodType<T>
    schemaName?: string
  }): Promise<T>
  generateJsonWithImage<T>(args: {
    system: string
    user: string
    image: { data: Buffer; mimeType: string }
    schema: ZodType<T>
    schemaName?: string
  }): Promise<T>
}
