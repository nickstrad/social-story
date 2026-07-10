import type { Character, Rule } from "@/server/domain/types"

const joinNames = (names: string[]) => {
  if (names.length < 2) return names[0] ?? "Selected characters"
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`
}

export function describeRule(
  rule: Pick<Rule, "kind" | "text" | "characterIds">,
  characters: Pick<Character, "id" | "name">[]
): string {
  if (rule.kind === "FREEFORM") return rule.text
  const names = joinNames(
    rule.characterIds.flatMap((id) => {
      const character = characters.find((item) => item.id === id)
      return character ? [character.name] : []
    })
  )
  if (rule.kind === "TOGETHER") return `${names} always appear together`
  if (rule.kind === "ALWAYS_INCLUDE") return `Always include ${names}`
  return `Never include ${names}`
}
