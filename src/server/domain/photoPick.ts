import type { Character } from "./types"

/**
 * Deterministic port of the CLI's `pickPhoto` heuristic: decide which single
 * character photo (if any) to attach as an extra reference for a page render.
 *
 * Policy:
 * - With an anchor (base reference sheet) present, attach NO extra photo — the
 *   sheet already fixes every character's look, and a lone photo would bias the
 *   render toward one person.
 * - Otherwise attach a photo only when EXACTLY ONE of the page's characters has
 *   a photo. Zero photos → nothing to attach; two or more → ambiguous, so we
 *   attach none rather than arbitrarily favouring one likeness.
 */
export function pickReferencePhoto({
  pageCharacters,
  hasAnchor,
}: {
  pageCharacters: Character[]
  hasAnchor: boolean
}): Character | null {
  if (hasAnchor) return null

  const withPhoto = pageCharacters.filter((character) =>
    Boolean(character.photoUrl)
  )
  return withPhoto.length === 1 ? withPhoto[0] : null
}
