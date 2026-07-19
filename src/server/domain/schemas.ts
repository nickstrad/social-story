import { z } from "zod"

const requiredText = z.string().trim().min(1)

function parsedStoryShape(characterNames: z.ZodType<string>) {
  return z.object({
    title: requiredText,
    pages: z.array(
      z.object({
        page: z.number().int().positive(),
        text: requiredText,
        imagePrompt: requiredText,
        characterNames: z.array(characterNames),
      })
    ),
  })
}

export const parsedStorySchema = parsedStoryShape(requiredText)

/**
 * Per-request parse schema. With a non-empty roster the character names are an
 * enum, so OpenAI structured outputs in `strict` mode make an off-roster name
 * impossible rather than merely unlikely — name resolution downstream is then a
 * defensive layer, not the mechanism. An empty roster falls back to the static
 * unconstrained schema (an enum needs at least one member).
 */
export function buildParsedStorySchema(characterNames: string[]) {
  const names = characterNames.map((name) => name.trim()).filter(Boolean)
  if (names.length === 0) return parsedStorySchema
  return parsedStoryShape(z.enum(names))
}

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
  isOptional: z.boolean().optional(),
})

type RuleKind = "TOGETHER" | "ALWAYS_INCLUDE" | "NEVER_INCLUDE" | "FREEFORM"

export const minCharacterIds = (kind: RuleKind) =>
  kind === "FREEFORM" ? 0 : kind === "TOGETHER" ? 2 : 1

export const ruleInputSchema = z
  .object({
    text: requiredText.max(2_000),
    kind: z.enum(["TOGETHER", "ALWAYS_INCLUDE", "NEVER_INCLUDE", "FREEFORM"]),
    characterIds: z.array(requiredText),
  })
  .superRefine((rule, ctx) => {
    const minimum = minCharacterIds(rule.kind)
    if (rule.characterIds.length < minimum) {
      ctx.addIssue({
        code: "custom",
        path: ["characterIds"],
        message:
          rule.kind === "TOGETHER"
            ? "Together rules require at least two characters"
            : "This rule requires at least one character",
      })
    }
  })

export type ParsedStory = z.infer<typeof parsedStorySchema>
