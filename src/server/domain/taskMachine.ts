import type { Task, TaskStatus } from "./types"

const TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  PENDING: ["RUNNING", "FAILED"],
  RUNNING: ["SUCCEEDED", "FAILED"],
  SUCCEEDED: [],
  FAILED: [],
}

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export function nextVariant(existingVariants: number[]): number {
  return Math.max(0, ...existingVariants) + 1
}

export function summarizeStoryTasks(tasks: Task[]): {
  pending: number
  running: number
  failed: number
  done: number
} {
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
