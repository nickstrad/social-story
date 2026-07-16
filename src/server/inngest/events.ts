import { eventType } from "inngest"
import { z } from "zod"

export const taskDispatchEvent = eventType("task/dispatch", {
  schema: z.object({
    taskId: z.string().min(1),
    userId: z.string().min(1),
  }),
})
