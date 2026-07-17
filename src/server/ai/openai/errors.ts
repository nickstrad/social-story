import { AiActionError } from "../errors"
import { OpenAIHttpError } from "./http"

export function mapOpenAIError(error: unknown): AiActionError {
  if (error instanceof AiActionError) return error
  if (error instanceof OpenAIHttpError) {
    if (error.status === 429)
      return new AiActionError("rate_limited", { cause: error })
    if (error.status === 401 || error.status === 403) {
      return new AiActionError("misconfigured", { cause: error })
    }
    if (error.status >= 500) {
      return new AiActionError("unavailable", { cause: error })
    }
    return new AiActionError("invalid_input", { cause: error })
  }
  return new AiActionError("unavailable", { cause: error })
}

export async function runOpenAIAction<T>(
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw mapOpenAIError(error)
  }
}
