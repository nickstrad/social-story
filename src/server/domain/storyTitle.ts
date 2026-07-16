import type { Story } from "./types"

export const UNTITLED_STORY = "Untitled story"

/**
 * How a story names itself in the UI. Titles are optional and stored raw, so
 * every surface that shows one needs the same trim-then-fall-back rule — keep
 * it here so the sidebar, the story list, and artifact labels can't drift.
 */
export function storyTitle(story: Pick<Story, "title">): string {
  return story.title.trim() || UNTITLED_STORY
}
