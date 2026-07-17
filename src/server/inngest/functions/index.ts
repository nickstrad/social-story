import { getDeps, type Deps } from "@/server/container"
import type { TaskType } from "@/server/domain/types"
import { inngest } from "@/server/inngest/client"
import { taskEventFor, type TaskEventDefinition } from "@/server/inngest/events"
import { getTaskHandler } from "@/server/inngest/handlers"
import { taskWorkflows, type TaskWorkflow } from "@/server/inngest/workflows"
import {
  claimTask,
  completeTask,
  failTask,
  runTask,
  type TaskHandler,
  type TaskStepRunner,
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

async function failOriginalTask(event: unknown, error: unknown) {
  const taskId = originalTaskId(event)
  if (taskId) await failTask(getDeps(), taskId, error)
}

const TASK_EXECUTION_OPTIONS = {
  idempotency: "event.data.taskId",
  retries: 4,
  concurrency: { limit: 10, key: "event.data.userId" },
} as const

function taskSteps(step: object): TaskStepRunner {
  // Inngest JSON-normalizes step results. Task handlers already restrict every
  // result to JsonValue, so its richer step object safely satisfies this port.
  return step as TaskStepRunner
}

async function executeTask({
  taskId,
  step,
  workflow,
}: {
  taskId: string
  step: TaskStepRunner
  workflow: TaskWorkflow
}) {
  const deps = getDeps()
  const claim = await step.run(workflow.claimStepName, async () => {
    const pending = await deps.repos.tasks.getById(taskId)
    if (pending && pending.type !== workflow.type) {
      throw new Error(
        `${workflow.functionName} received a ${pending.type} task`
      )
    }
    const claimed = await claimTask(deps, taskId)
    return {
      request: { taskType: workflow.type },
      response: {
        claimed: Boolean(claimed),
        taskId: claimed?.id ?? null,
      },
    }
  })
  if (!claim.response.taskId) return

  const task = await deps.repos.tasks.getById(claim.response.taskId)
  if (!task || task.status !== "RUNNING") return

  const result = await resolveTaskHandler(task.type)(task, deps, step)
  await step.run(workflow.completeStepName, async () => {
    const completed = await completeTask(deps, task.id, result)
    return {
      request: { taskType: task.type },
      response: { completed: Boolean(completed), taskId: task.id },
    }
  })
}

function createTaskFunction(
  workflow: TaskWorkflow,
  trigger: TaskEventDefinition
) {
  return inngest.createFunction(
    {
      id: workflow.functionId,
      name: workflow.functionName,
      description: workflow.description,
      triggers: [trigger],
      ...TASK_EXECUTION_OPTIONS,
      onFailure: ({ event, error }) =>
        failOriginalTask(event.data.event, error),
    },
    ({ event, step }) =>
      executeTask({
        taskId: event.data.taskId,
        step: taskSteps(step),
        workflow,
      })
  )
}

const taskFunctions = Object.values(taskWorkflows).map((workflow) =>
  createTaskFunction(workflow, taskEventFor(workflow.type))
)

export const allFunctions = taskFunctions
