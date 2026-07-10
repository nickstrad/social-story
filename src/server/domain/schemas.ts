import { z } from "zod"

const requiredText = z.string().trim().min(1)

export const parsedStorySchema = z.object({
  title: requiredText,
  pages: z.array(
    z.object({
      page: z.number().int().positive(),
      text: requiredText,
      imagePrompt: requiredText,
      characterNames: z.array(requiredText),
    })
  ),
})

export const createStorySchema = z.object({
  title: requiredText.max(200),
  script: requiredText.max(50_000),
})

export const steeringTextSchema = z.string().trim().max(2_000)

export const updatePageSchema = z.object({
  pageId: requiredText,
  text: requiredText.max(5_000).optional(),
  imagePrompt: requiredText.max(5_000).optional(),
  characterIds: z.array(requiredText).optional(),
  steeringText: steeringTextSchema.nullable().optional(),
  hidden: z.boolean().optional(),
})

export const characterInputSchema = z.object({
  name: requiredText.max(100),
  role: z.string().trim().max(100).nullable().optional(),
  age: z.string().trim().max(100).nullable().optional(),
  appearance: z.string().trim().max(2_000).nullable().optional(),
  photoDescription: z.string().trim().max(2_000).nullable().optional(),
})

export const ruleInputSchema = z.object({
  text: requiredText.max(2_000),
  kind: z.enum(["TOGETHER", "ALWAYS_INCLUDE", "NEVER_INCLUDE", "FREEFORM"]),
  characterIds: z.array(requiredText),
})

export type ParsedStory = z.infer<typeof parsedStorySchema>
