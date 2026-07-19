import type { StoryKind, StoryStatus } from "@/server/domain/types"

export type StepKey = "script" | "characters" | "base" | "pages" | "export"

export interface StepState {
  key: StepKey
  label: string
  /** Path segment appended to `/stories/[storyId]`, empty for the script root. */
  segment: string
  done: boolean
  enabled: boolean
}

export interface StoryStepInput {
  kind: StoryKind
  status: StoryStatus
  script: string
  charactersCount: number
  baseImageUrl: string | null
  pagesCount: number
  pagesWithImageCount: number
}

/**
 * Pure wizard-progress model shared by every `(app)/stories/[storyId]/*` page.
 * A step is `done` when its work is complete and `enabled` when the user has
 * satisfied enough of the earlier steps to act on it.
 */
export function deriveStepStates(story: StoryStepInput): StepState[] {
  const scriptDone = story.script.trim().length > 0
  const parsed = story.status !== "DRAFT" && story.pagesCount > 0
  const hasCharacters = story.charactersCount > 0
  const hasBaseImage = story.baseImageUrl !== null
  const hasPageImages = story.pagesWithImageCount > 0

  const steps: StepState[] = [
    {
      key: "script",
      label: "Script",
      segment: "script",
      done: scriptDone,
      enabled: true,
    },
    {
      key: "characters",
      label: "Characters",
      segment: "characters",
      // Splitting the script into pages is this step's other job, so a
      // deliberately scene-only story counts as done once it has parsed.
      done: hasCharacters || parsed,
      enabled: scriptDone,
    },
    {
      key: "base",
      label: "Base image",
      segment: "base",
      done: hasBaseImage,
      enabled: hasCharacters,
    },
    {
      key: "pages",
      label: "Pages",
      segment: "pages",
      done: hasPageImages,
      enabled: parsed,
    },
    {
      key: "export",
      label: "Export",
      segment: "export",
      done: story.status === "READY",
      enabled: hasPageImages,
    },
  ]
  return steps.filter((step) => {
    if (step.key === "export" && story.kind === "TEMPLATE") return false
    // A scene-only book (parsed with an empty roster) has no cast to anchor, so
    // the character reference sheet does not apply. Dropping the step keeps the
    // wizard's next-step affordance pointing somewhere reachable instead of at
    // a permanently disabled one.
    return !(step.key === "base" && parsed && !hasCharacters)
  })
}
