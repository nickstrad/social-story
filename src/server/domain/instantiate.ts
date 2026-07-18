import type {
  Character,
  CreateCharacter,
  CreatePage,
  CreateRule,
  CreateStory,
  Page,
  Rule,
  Story,
} from "./types"

export interface CastEntry {
  templateCharacterId: string
  name: string
  include: boolean
}

export interface InstantiationCharacter extends Omit<
  CreateCharacter,
  "storyId"
> {
  templateCharacterId: string
}

export interface InstantiationPlan {
  story: Omit<CreateStory, "userId">
  characters: InstantiationCharacter[]
  rules: Omit<CreateRule, "storyId">[]
  pages: Omit<CreatePage, "storyId">[]
}

export function remapCharacterIds(
  ids: string[],
  mapping: Map<string, string>
): string[] {
  return ids.flatMap((id) => {
    const mapped = mapping.get(id)
    return mapped ? [mapped] : []
  })
}

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

export function renameInText(
  text: string,
  renames: Array<{ from: string; to: string }>
): string {
  const replacements = new Map(
    renames
      .filter(({ from }) => from.length > 0)
      .map(({ from, to }) => [from, to])
  )
  const names = [...replacements.keys()].sort(
    (left, right) => right.length - left.length
  )
  if (names.length === 0) return text

  const pattern = names.map(escapeRegExp).join("|")
  return text.replace(
    new RegExp(`(?<![\\p{L}\\p{N}_])(?:${pattern})(?![\\p{L}\\p{N}_])`, "gu"),
    (name) => replacements.get(name) ?? name
  )
}

export function buildInstantiation(
  template: {
    story: Story
    characters: Character[]
    rules: Rule[]
    pages: Page[]
  },
  input: { title: string; cast: CastEntry[] }
): InstantiationPlan {
  const castByCharacterId = new Map(
    input.cast.map((entry) => [entry.templateCharacterId, entry])
  )
  const mapping = new Map<string, string>()
  const renames: Array<{ from: string; to: string }> = []
  const characters: InstantiationCharacter[] = []

  for (const character of template.characters) {
    const cast = castByCharacterId.get(character.id)
    if (!cast?.include) continue
    const id = crypto.randomUUID()
    mapping.set(character.id, id)
    renames.push({ from: character.name, to: cast.name })
    characters.push({
      id,
      templateCharacterId: character.id,
      name: cast.name,
      role: character.role,
      age: character.age,
      appearance: null,
      photoAssetId: null,
      photoDescription: null,
      libraryCharacterId: null,
      isOptional: character.isOptional,
    })
  }

  const rename = (value: string) => renameInText(value, renames)
  return {
    story: {
      title: rename(input.title),
      script: rename(template.story.script),
      kind: "STORY",
      templateId: template.story.id,
      status: "PARSED",
      coverNote: template.story.coverNote
        ? rename(template.story.coverNote)
        : null,
    },
    characters,
    rules: template.rules.flatMap((rule) => {
      const characterIds = remapCharacterIds(rule.characterIds, mapping)
      if (characterIds.length === 0 && rule.kind !== "FREEFORM") return []
      return [
        {
          text: rename(rule.text),
          kind: rule.kind,
          characterIds,
        },
      ]
    }),
    pages: template.pages.map((page) => ({
      kind: page.kind,
      position: page.position,
      text: rename(page.text),
      imagePrompt: rename(page.imagePrompt),
      characterIds: remapCharacterIds(page.characterIds, mapping),
      steeringText: page.steeringText,
      hidden: page.hidden,
    })),
  }
}
