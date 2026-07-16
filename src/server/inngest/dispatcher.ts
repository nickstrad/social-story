import { inngest } from "@/server/inngest/client"
import { taskDispatchEvent } from "@/server/inngest/events"
import type { TaskDispatcher } from "@/server/ports/dispatcher"
import type { Repos } from "@/server/ports/repos"

export function inngestDispatcher(repos: Repos): TaskDispatcher {
  return {
    async dispatch(taskId) {
      const task = await repos.tasks.getById(taskId)
      if (!task) throw new Error(`Task ${taskId} not found`)
      const event = taskDispatchEvent.create(
        { taskId, userId: task.userId },
        { id: task.id }
      )
      await event.validate()
      await inngest.send(event)
    },
  }
}
