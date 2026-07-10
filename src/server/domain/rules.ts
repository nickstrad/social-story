import type { Character, Page, Rule } from "./types"

export function applyRulesToPage(
  characterIds: string[],
  rules: Rule[],
  allCharacters: Character[]
): { characterIds: string[]; changed: boolean } {
  const original = [...characterIds]
  const validIds = new Set(allCharacters.map(({ id }) => id))
  const result = characterIds.filter((id) => validIds.has(id))
  const present = new Set(result)

  let addedTogetherCharacter: boolean
  do {
    addedTogetherCharacter = false
    for (const rule of rules) {
      if (
        rule.kind === "TOGETHER" &&
        rule.characterIds.some((id) => present.has(id))
      ) {
        for (const id of rule.characterIds) {
          if (validIds.has(id) && !present.has(id)) {
            result.push(id)
            present.add(id)
            addedTogetherCharacter = true
          }
        }
      }
    }
  } while (addedTogetherCharacter)

  if (result.length > 0) {
    for (const rule of rules) {
      if (rule.kind !== "ALWAYS_INCLUDE") continue
      for (const id of rule.characterIds) {
        if (validIds.has(id) && !present.has(id)) {
          result.push(id)
          present.add(id)
        }
      }
    }
  }

  // NEVER_INCLUDE has final precedence over every additive rule.
  const excluded = new Set(
    rules
      .filter(({ kind }) => kind === "NEVER_INCLUDE")
      .flatMap(({ characterIds: ids }) => ids)
  )
  const finalIds = result.filter((id) => !excluded.has(id))
  const changed =
    finalIds.length !== original.length ||
    finalIds.some((id, index) => id !== original[index])
  return { characterIds: finalIds, changed }
}

export function applyRulesToStory(
  pages: Page[],
  rules: Rule[],
  characters: Character[]
): { pages: Page[]; changed: number } {
  let changed = 0
  const nextPages = pages.map((page) => {
    const applied = applyRulesToPage(page.characterIds, rules, characters)
    if (!applied.changed) return page
    changed += 1
    return { ...page, characterIds: applied.characterIds }
  })
  return { pages: nextPages, changed }
}
