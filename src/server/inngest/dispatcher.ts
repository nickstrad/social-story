import { inngest } from "@/server/inngest/client"
import type { TaskDispatcher } from "@/server/ports/dispatcher"
import type { Repos } from "@/server/ports/repos"

export function inngestDispatcher(repos: Repos): TaskDispatcher {
  return {
    async dispatch(taskId) {
      const task = await repos.tasks.getById(taskId)
      if (!task) throw new Error(`Task ${taskId} not found`)
      await inngest.send({
        name: "task/dispatch",
        data: { taskId, userId: task.userId },
      })
    },
  }
}
