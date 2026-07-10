export interface TaskDispatcher {
  dispatch(taskId: string): Promise<void>
}
