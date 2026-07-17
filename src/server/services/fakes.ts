import type { TaskDispatcher } from "../ports/dispatcher"

export function immediateDispatcher(
  runner: (taskId: string) => Promise<void>
): TaskDispatcher {
  return { dispatch: runner }
}
