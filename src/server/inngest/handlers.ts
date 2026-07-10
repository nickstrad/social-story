import type { TaskType } from "@/server/domain/types"
import type { TaskHandler } from "@/server/services/tasks"

const handlers = new Map<TaskType, TaskHandler>()

export function registerTaskHandler(
  type: TaskType,
  handler: TaskHandler
): void {
  handlers.set(type, handler)
}

export function getTaskHandler(type: TaskType): TaskHandler | undefined {
  return handlers.get(type)
}
