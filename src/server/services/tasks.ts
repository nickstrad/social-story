import type { Deps } from "@/server/container"
import { canTransition } from "@/server/domain/taskMachine"
import type { JsonValue, Task, TaskType } from "@/server/domain/types"

export interface CreateTaskInput {
  userId: string
  storyId: string
  pageId?: string
  type: TaskType
}

export async function createTask(
  deps: Deps,
  input: CreateTaskInput
): Promise<Task> {
  const task = await deps.repos.tasks.create({
    ...input,
    status: "PENDING",
  })
  await deps.dispatcher.dispatch(task.id)
  return task
}

export type TaskHandler = (
  task: Task,
  deps: Deps
) => Promise<JsonValue | undefined>

export async function runTask(
  deps: Deps,
  taskId: string,
  handler: TaskHandler
): Promise<void> {
  const task = await deps.repos.tasks.getById(taskId)
  if (!task || !canTransition(task.status, "RUNNING")) return

  // The repository claim repeats the status condition as a compare-and-set so
  // this domain-approved transition remains safe across duplicate deliveries.
  const runningTask = await deps.repos.tasks.claimPending(taskId, new Date())
  if (!runningTask) return

  try {
    const result = await handler(runningTask, deps)
    await deps.repos.tasks.update(runningTask.id, {
      status: "SUCCEEDED",
      resultJson: result ?? null,
      finishedAt: new Date(),
    })
  } catch (error) {
    await deps.repos.tasks.update(runningTask.id, {
      status: "FAILED",
      error: error instanceof Error ? error.message : String(error),
      finishedAt: new Date(),
    })
  }
}
