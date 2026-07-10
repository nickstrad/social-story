"use client"

import type { TaskStatus } from "@/server/domain/types"
import { summarizeStoryTasks } from "@/server/domain/taskMachine"
import { trpc } from "@/lib/trpc"

export function pollInterval(status: TaskStatus | undefined): number | false {
  return status === "PENDING" || status === "RUNNING" ? 1500 : false
}

export function useTask(taskId: string) {
  return trpc.task.get.useQuery(
    { taskId },
    {
      enabled: Boolean(taskId),
      refetchInterval: (query) => pollInterval(query.state.data?.status),
    }
  )
}

export function useStoryTasks(storyId: string) {
  const query = trpc.task.listForStory.useQuery(
    { storyId },
    {
      enabled: Boolean(storyId),
      refetchInterval: (query) => {
        const tasks = query.state.data
        return tasks?.some((task) => pollInterval(task.status) !== false)
          ? 1500
          : false
      },
    }
  )
  const tasks = query.data ?? []
  return { ...query, tasks, summary: summarizeStoryTasks(tasks) }
}
