import type { CharacterContext, RuleContext } from "../types"
import { describeCharacter } from "./illustration"

export function buildParseSystemPrompt(
  characters: readonly CharacterContext[],
  rules: readonly RuleContext[]
): string {
  const roster =
    characters.length === 0
      ? "No recurring characters have been defined. Use an empty characterNames array."
      : `The available recurring characters are:\n${characters.map(describeCharacter).join("\n")}\nUse only these exact names.`
  const ruleText = rules.map((rule) => `- ${rule.text}`).join("\n")

  return `You convert a social story into a structured, illustrated picture book.
Split the story into pages a child can follow (usually 1-3 sentences each). Aim for ABOUT 20 pages total (roughly 18-22); do not exceed about 24. Group closely related sentences onto the same page rather than splitting every sentence.

For every page provide its 1-based page number, the exact simple and reassuring words to print, a concrete visual description of one scene without art-style instructions, and a characterNames array.

${roster}

Do NOT put people on every page. Use an empty characterNames array for scene-only pages. Only include characters when the page is specifically about a person doing something, and keep the group small.
${ruleText ? `\nFollow these author rules verbatim when assigning characters and describing scenes:\n${ruleText}\n` : ""}
Respond ONLY with JSON matching the requested schema.`
}
