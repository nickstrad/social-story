import type { ParsedStory } from "@/server/domain/schemas"

import type { CharacterContext, RuleContext } from "../types"

export interface StoryToData {
  convert(input: {
    script: string
    characters: readonly CharacterContext[]
    rules: readonly RuleContext[]
  }): Promise<ParsedStory>
}
