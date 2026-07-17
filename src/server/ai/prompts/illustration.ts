import type { CharacterContext, RuleContext } from "../types"

const DEFAULT_READER_DESCRIPTION =
  "a child who benefits from a calm, clear children's social-story style"

const BASE_SHEET_INSTRUCTION = `A character reference sheet is attached as the FIRST image. It shows the established look of the characters. Match each character's face, hair, skin tone, body proportions, age, and gender to that sheet so they stay consistent with the rest of the book. You MAY change their clothing, pose, and the setting to fit this page's scene — only their identity and art style must match the sheet.`

export function buildStyleContext({
  readerDescription = DEFAULT_READER_DESCRIPTION,
}: { readerDescription?: string } = {}): string {
  return `Warm, friendly children's book illustration for a social story, drawn respectfully and authentically.
The book is for ${readerDescription.trim() || DEFAULT_READER_DESCRIPTION}, so keep every scene calm and clear: soft colors, gentle lighting, uncluttered backgrounds, simple and unambiguous shapes, no scary or overwhelming imagery, and a single obvious focal point.
Consistent art style across all pages.
Many pages show only a place, object, or activity with NO people in them — that is expected and good. Only include people when this page's scene specifically calls for them, and never add extra characters that were not asked for.`
}

export function describeCharacter(character: CharacterContext): string {
  const details = [character.role, character.age, character.appearance].filter(
    (value): value is string => Boolean(value?.trim())
  )
  return `- ${character.name}: ${details.join(", ") || "recurring character"}.`
}

export function buildCastDescription(
  characters: readonly CharacterContext[]
): string {
  if (characters.length === 0) return ""
  return `Keep these characters exact and consistent every time:
${characters.map(describeCharacter).join("\n")}
Only include the specific characters this page calls for; do not add extra people.`
}

export function buildImagePrompt({
  scene,
  characters,
  allCharacters,
  anchored,
  steeringText,
  rules = [],
}: {
  scene: string
  characters: readonly CharacterContext[]
  allCharacters: readonly CharacterContext[]
  anchored: boolean
  steeringText?: string
  rules?: readonly RuleContext[]
}): string {
  const parts = [buildStyleContext(), `Scene for this page: ${scene.trim()}`]

  if (characters.length === 0) {
    parts.push(
      "This page has NO people in it. Illustrate only the place, objects, or activity described — do not add any characters or figures."
    )
  } else {
    parts.push(buildCastDescription(allCharacters))
    parts.push(
      `Exactly these characters appear together in this scene: ${characters.map(({ name }) => name).join(", ")}. Include every one of them and no other people.`
    )
    if (anchored) parts.push(BASE_SHEET_INSTRUCTION)
  }

  const freeformRules = rules.filter(({ kind }) => kind === "FREEFORM")
  if (freeformRules.length > 0) {
    parts.push(
      `Additional author rules:\n${freeformRules.map(({ text }) => `- ${text}`).join("\n")}`
    )
  }

  if (steeringText?.trim()) {
    parts.push(`Additional direction from the author: ${steeringText.trim()}`)
  }
  return parts.filter(Boolean).join("\n\n")
}

export function buildBaseSheetPrompt(
  characters: readonly CharacterContext[]
): string {
  return [
    buildStyleContext(),
    buildCastDescription(characters),
    "Produce a CHARACTER REFERENCE SHEET (not a story scene): all characters standing in a row, full body, facing forward, evenly lit on a plain neutral background with no props, furniture, or scenery. Simple everyday clothing. Clear, friendly faces. The goal is a clean model sheet that defines each character's look so they can be drawn consistently across the whole book. Attached photos show the real people — match their likeness.",
  ]
    .filter(Boolean)
    .join("\n\n")
}

export function buildCoverPrompt({
  title,
  characters,
  note,
}: {
  title: string
  characters: readonly CharacterContext[]
  note?: string
}): string {
  const subjects =
    characters.length > 0
      ? "Show the listed characters together in a warm, welcoming cover scene, facing forward and smiling as a friendly group portrait."
      : "Create a warm, welcoming cover scene that gently suggests the story's subject without adding people."
  const parts = [
    buildStyleContext(),
    buildCastDescription(characters),
    `Produce a BOOK COVER illustration for a children's social story titled "${title.trim()}". ${subjects} Keep the composition calm and uncluttered with plenty of open space near the top and bottom. Do NOT draw any text, letters, words, or a title in the image — the title will be added separately.`,
  ]
  if (note?.trim()) {
    parts.push(
      `Also incorporate these details into the cover scene: ${note.trim()}. Keep them tasteful and clear, and still do not draw any text or words.`
    )
  }
  return parts.filter(Boolean).join("\n\n")
}
