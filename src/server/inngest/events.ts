import { EventType, eventType } from "inngest"
import { z } from "zod"

import type { TaskType } from "@/server/domain/types"
import { taskWorkflows } from "@/server/inngest/workflows"

export const taskEventSchema = z.object({
  taskId: z.string().min(1),
  userId: z.string().min(1),
})

export type TaskEventDefinition = EventType<string, typeof taskEventSchema>

export const taskEvents = {
  PARSE_STORY: eventType(taskWorkflows.PARSE_STORY.eventName, {
    schema: taskEventSchema,
  }),
  BASE_IMAGE: eventType(taskWorkflows.BASE_IMAGE.eventName, {
    schema: taskEventSchema,
  }),
  PAGE_IMAGE: eventType(taskWorkflows.PAGE_IMAGE.eventName, {
    schema: taskEventSchema,
  }),
  PDF_EXPORT: eventType(taskWorkflows.PDF_EXPORT.eventName, {
    schema: taskEventSchema,
  }),
} as const satisfies Record<TaskType, TaskEventDefinition>

export function taskEventFor(type: TaskType): TaskEventDefinition {
  return taskEvents[type]
}
