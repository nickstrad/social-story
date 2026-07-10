import { getDeps, type Deps } from "@/server/container"
import { inngest } from "@/server/inngest/client"
import { getTaskHandler } from "@/server/inngest/handlers"
import { runTask } from "@/server/services/tasks"

// Side-effect imports: register concrete task handlers with the handler
// registry so dispatchTask can resolve them.
import "./baseImage"
import "./pageImage"
import "./parseStory"

export async function dispatchTask(deps: Deps, taskId: string): Promise<void> {
  const task = await deps.repos.tasks.getById(taskId)
  if (!task) return

  // Concrete task modules must register handlers when this route's function
  // index is loaded; an absent handler is a permanent configuration error.
  const handler =
    getTaskHandler(task.type) ??
    (async () => {
      throw new Error(`No handler registered for ${task.type}`)
    })
  await runTask(deps, task.id, handler)
}

export const taskDispatchFn = inngest.createFunction(
  {
    id: "task-dispatch",
    triggers: [{ event: "task/dispatch" }],
    concurrency: { limit: 10, key: "event.data.userId" },
  },
  async ({ event }) => dispatchTask(getDeps(), event.data.taskId)
)

export const allFunctions = [taskDispatchFn]
