import type { Deps } from "@/server/container"
import type {
  JsonValue,
  Task,
  TaskStatus,
  TaskType,
} from "@/server/domain/types"

export interface CreateTaskInput {
  userId: string
  storyId: string
  pageId?: string
  type: TaskType
}

const STALE_AFTER_MS: Partial<Record<TaskStatus, number>> = {
  PENDING: 5 * 60 * 1000,
  RUNNING: 30 * 60 * 1000,
}
const STALE_TASK_ERROR =
  "This task stopped responding before it completed. Retry to continue."

export function isStaleTask(task: Task, now = new Date()): boolean {
  const staleAfter = STALE_AFTER_MS[task.status]
  return (
    staleAfter !== undefined &&
    now.getTime() - task.updatedAt.getTime() > staleAfter
  )
}

export async function recoverStaleTask(
  deps: Deps,
  task: Task,
  now = new Date()
): Promise<Task> {
  if (!isStaleTask(task, now)) return task
  const failed = await deps.repos.tasks.failActive(
    task.id,
    STALE_TASK_ERROR,
    now
  )
  if (failed) return failed
  return (await deps.repos.tasks.getById(task.id)) ?? task
}

export async function listStoryTasks(
  deps: Deps,
  storyId: string,
  now = new Date()
): Promise<Task[]> {
  const tasks = await deps.repos.tasks.listByStory(storyId)
  return Promise.all(tasks.map((task) => recoverStaleTask(deps, task, now)))
}

export async function createTask(
  deps: Deps,
  input: CreateTaskInput
): Promise<Task> {
  const task = await deps.repos.tasks.create({
    ...input,
    status: "PENDING",
  })
  try {
    await deps.dispatcher.dispatch(task.id)
  } catch (error) {
    await deps.repos.tasks.failActive(
      task.id,
      `Task could not be queued: ${errorMessage(error)}`,
      new Date()
    )
    throw error
  }
  return task
}

export type TaskHandler = (
  task: Task,
  deps: Deps
) => Promise<JsonValue | undefined>

export async function claimTask(
  deps: Deps,
  taskId: string
): Promise<Task | null> {
  return deps.repos.tasks.claimPending(taskId, new Date())
}

export async function completeTask(
  deps: Deps,
  taskId: string,
  result: JsonValue | undefined
): Promise<Task | null> {
  return deps.repos.tasks.completeRunning(taskId, {
    resultJson: result ?? null,
    finishedAt: new Date(),
  })
}

export async function failTask(
  deps: Deps,
  taskId: string,
  error: unknown
): Promise<Task | null> {
  return deps.repos.tasks.failActive(taskId, errorMessage(error), new Date())
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function runTask(
  deps: Deps,
  taskId: string,
  handler: TaskHandler
): Promise<void> {
  const runningTask = await claimTask(deps, taskId)
  if (!runningTask) return

  try {
    const result = await handler(runningTask, deps)
    await completeTask(deps, runningTask.id, result)
  } catch (error) {
    await failTask(deps, runningTask.id, error)
  }
}
