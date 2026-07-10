import type { TaskStatus } from "@/server/domain/types"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const labels: Record<TaskStatus, string> = {
  PENDING: "Pending",
  RUNNING: "Running",
  SUCCEEDED: "Complete",
  FAILED: "Failed",
}

export function TaskStatusBadge({
  status,
  error,
}: {
  status: TaskStatus
  error?: string | null
}) {
  const badge = (
    <Badge variant={status === "FAILED" ? "destructive" : "secondary"}>
      {status === "RUNNING" && <Spinner />}
      {labels[status]}
    </Badge>
  )

  if (status !== "FAILED" || !error) return badge
  return (
    <Tooltip>
      <TooltipTrigger render={badge} />
      <TooltipContent>{error}</TooltipContent>
    </Tooltip>
  )
}
