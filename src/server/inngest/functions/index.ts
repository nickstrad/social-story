import { getDeps, type Deps } from "@/server/container"
import type { TaskType } from "@/server/domain/types"
import { inngest } from "@/server/inngest/client"
import { taskDispatchEvent } from "@/server/inngest/events"
import { getTaskHandler } from "@/server/inngest/handlers"
import {
  claimTask,
  completeTask,
  failTask,
  runTask,
  type TaskHandler,
} from "@/server/services/tasks"

// Side-effect imports: register concrete task handlers with the handler
// registry so dispatchTask can resolve them.
import "./baseImage"
import "./pageImage"
import "./parseStory"
import "./pdfExport"

export async function dispatchTask(deps: Deps, taskId: string): Promise<void> {
  const task = await deps.repos.tasks.getById(taskId)
  if (!task) return
  await runTask(deps, task.id, resolveTaskHandler(task.type))
}

function resolveTaskHandler(type: TaskType): TaskHandler {
  return (
    getTaskHandler(type) ??
    (async () => {
      throw new Error(`No handler registered for ${type}`)
    })
  )
}

function originalTaskId(event: unknown): string | undefined {
  if (!event || typeof event !== "object" || !("data" in event)) return
  const data = event.data
  if (!data || typeof data !== "object" || !("taskId" in data)) return
  return typeof data.taskId === "string" ? data.taskId : undefined
}

export const taskDispatchFn = inngest.createFunction(
  {
    id: "task-dispatch",
    triggers: [taskDispatchEvent],
    idempotency: "event.data.taskId",
    retries: 4,
    concurrency: { limit: 10, key: "event.data.userId" },
    onFailure: async ({ event, error }) => {
      const taskId = originalTaskId(event.data.event)
      if (taskId) await failTask(getDeps(), taskId, error)
    },
  },
  async ({ event, step }) => {
    const deps = getDeps()
    const taskId = event.data.taskId
    const claimedTaskId = await step.run("claim-task", async () => {
      const claimed = await claimTask(deps, taskId)
      return claimed?.id ?? null
    })
    if (!claimedTaskId) return

    const task = await deps.repos.tasks.getById(claimedTaskId)
    if (!task || task.status !== "RUNNING") return
    const result = await step.run("execute-task", () =>
      resolveTaskHandler(task.type)(task, deps)
    )
    await step.run("complete-task", async () =>
      Boolean(await completeTask(deps, task.id, result))
    )
  }
)

export const allFunctions = [taskDispatchFn]
