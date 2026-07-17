export type AiActionErrorCode =
  | "invalid_input"
  | "content_rejected"
  | "invalid_response"
  | "rate_limited"
  | "unavailable"
  | "misconfigured"

const DEFAULT_MESSAGES: Record<AiActionErrorCode, string> = {
  invalid_input: "The AI request could not be processed.",
  content_rejected:
    "The AI service could not complete this request. Try adjusting the content.",
  invalid_response:
    "The AI service returned an unusable response. Please try again.",
  rate_limited: "The AI service is busy. Please try again shortly.",
  unavailable: "The AI service is temporarily unavailable. Please try again.",
  misconfigured: "AI generation is not configured.",
}

const RETRYABLE = new Set<AiActionErrorCode>([
  "invalid_response",
  "rate_limited",
  "unavailable",
])

export class AiActionError extends Error {
  readonly code: AiActionErrorCode
  readonly retryable: boolean

  constructor(
    code: AiActionErrorCode,
    options: { cause?: unknown; retryable?: boolean } = {}
  ) {
    super(DEFAULT_MESSAGES[code], { cause: options.cause })
    this.name = "AiActionError"
    this.code = code
    this.retryable = options.retryable ?? RETRYABLE.has(code)
  }
}
