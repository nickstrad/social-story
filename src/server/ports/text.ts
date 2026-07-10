import type { ZodType } from "zod"

export interface TextGenerator {
  generateJson<T>(args: {
    system: string
    user: string
    schema: ZodType<T>
    schemaName?: string
  }): Promise<T>
}
