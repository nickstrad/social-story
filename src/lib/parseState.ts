import type { StoryStatus, Task } from "@/server/domain/types"

export type ParseState = "idle" | "parsing" | "done" | "error"

export interface ParseStateResult {
  state: ParseState
  pageCount?: number
  error?: string
}

/**
 * Derive the script-step parse state from the active parse task (if any) and
 * the persisted story. The task is authoritative while it exists; once it is
 * gone we fall back to the story's own status/page count so a reload after a
 * completed parse still reads as "done".
 */
export function deriveParseState(
  task: Task | undefined,
  story: { status: StoryStatus; pageCount: number }
): ParseStateResult {
  if (task) {
    if (task.status === "PENDING" || task.status === "RUNNING")
      return { state: "parsing" }
    if (task.status === "FAILED")
      return { state: "error", error: task.error ?? "Parsing failed" }
    if (task.status === "SUCCEEDED") {
      const pageCount = readPageCount(task) ?? story.pageCount
      return { state: "done", pageCount }
    }
  }
  if (story.status !== "DRAFT" && story.pageCount > 0)
    return { state: "done", pageCount: story.pageCount }
  return { state: "idle" }
}

function readPageCount(task: Task): number | undefined {
  const result = task.resultJson
  if (result && typeof result === "object" && !Array.isArray(result)) {
    const value = result.pageCount
    if (typeof value === "number") return value
  }
  return undefined
}
