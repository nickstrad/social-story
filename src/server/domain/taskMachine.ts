import type { Task, TaskStatus, TaskType } from "./types"

const TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  PENDING: ["RUNNING", "FAILED"],
  RUNNING: ["SUCCEEDED", "FAILED"],
  SUCCEEDED: [],
  FAILED: [],
}

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

/** A task status is "active" (in flight) when it is queued or running. */
export function isActiveStatus(status: TaskStatus | undefined): boolean {
  return status === "PENDING" || status === "RUNNING"
}

export function isActiveTask(task: Task): boolean {
  return isActiveStatus(task.status)
}

/**
 * True when a task of the given type is already queued or running. Pass a
 * `pageId` to scope the check to one page (page renders), or omit it for
 * story-wide exclusivity (parsing). Callers use this to refuse launching a
 * second, racing task for the same scope.
 */
export function hasActiveTask(
  tasks: Task[],
  filter: { type: TaskType; pageId?: string }
): boolean {
  return tasks.some(
    (task) =>
      isActiveTask(task) &&
      task.type === filter.type &&
      (filter.pageId === undefined || task.pageId === filter.pageId)
  )
}

export function nextVariant(existingVariants: number[]): number {
  return Math.max(0, ...existingVariants) + 1
}

export interface TaskProgress {
  pending: number
  running: number
  failed: number
  done: number
}

export function summarizeStoryTasks(tasks: Task[]): TaskProgress {
  return tasks.reduce(
    (summary, task) => {
      const key =
        task.status === "SUCCEEDED" ? "done" : task.status.toLowerCase()
      summary[key as "pending" | "running" | "failed" | "done"] += 1
      return summary
    },
    { pending: 0, running: 0, failed: 0, done: 0 }
  )
}
