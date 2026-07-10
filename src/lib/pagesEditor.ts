import { applyRulesToPage } from "@/server/domain/rules"
import type { Character, Page, Rule } from "@/server/domain/types"
import type { PageGenState } from "@/hooks/usePageGeneration"

/** A page as returned by `story.get`: the domain page plus its chosen image. */
export type EditorPage = Page & { selectedImageUrl: string | null }

/**
 * The page the focused editor should move to from `currentId` in direction
 * `dir` (+1 = next, -1 = previous). Pages are walked in stored order with the
 * cover first.
 *
 * Decision: the focused editor navigates through ALL pages, including hidden
 * ones — an author still edits a hidden page. (The PDF export, by contrast,
 * omits hidden pages via `visiblePagesInOrder`.) Returns `undefined` at either
 * end; navigation does not wrap.
 */
export function nextFocusable(
  pages: Page[],
  currentId: string,
  dir: 1 | -1
): string | undefined {
  const ordered = [...pages].sort((a, b) => a.position - b.position)
  const index = ordered.findIndex((page) => page.id === currentId)
  if (index === -1) return undefined
  return ordered[index + dir]?.id
}

/**
 * The effective cast for a page after visual rules are applied — mirrors the
 * server's `applyRulesToPage` so the editor can show auto-added characters
 * instantly, before the `page.update` round-trip returns.
 */
export function effectiveCharacters(
  page: Page,
  rules: Rule[],
  characters: Character[]
): string[] {
  return applyRulesToPage(page.characterIds, rules, characters).characterIds
}

export interface GridBadge {
  label: string
  variant: "secondary" | "destructive"
}

/**
 * The generation-state badge to overlay on a page's grid card, or `null` when
 * the card needs none (idle or a finished image the thumbnail already shows).
 */
export function gridBadge(genState: PageGenState): GridBadge | null {
  switch (genState) {
    case "queued":
      return { label: "Queued", variant: "secondary" }
    case "generating":
      return { label: "Generating", variant: "secondary" }
    case "failed":
      return { label: "Failed", variant: "destructive" }
    default:
      return null
  }
}
