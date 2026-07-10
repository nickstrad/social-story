const DEFAULT_MAX_RETRIES = 3
const MAX_BACKOFF_MS = 30_000

function retryAfterMilliseconds(value: string | null): number | undefined {
  if (!value) return undefined

  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000

  const date = Date.parse(value)
  if (Number.isNaN(date)) return undefined
  return Math.max(0, date - Date.now())
}

export function computeBackoff(
  attempt: number,
  retryAfterHeader?: string | null
): number {
  return Math.min(
    retryAfterMilliseconds(retryAfterHeader ?? null) ?? 1_000 * 2 ** attempt,
    MAX_BACKOFF_MS
  )
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500
}

async function errorFromResponse(response: Response): Promise<Error> {
  const body = await response.text()
  const detail = body ? `: ${body}` : ""
  return new Error(`OpenAI request failed (${response.status})${detail}`)
}

export async function requestWithRetry(
  fetchArgs: Parameters<typeof fetch>,
  { maxRetries = DEFAULT_MAX_RETRIES }: { maxRetries?: number } = {}
): Promise<Response> {
  for (let attempt = 0; ; attempt += 1) {
    let response: Response
    try {
      response = await fetch(...fetchArgs)
    } catch (error) {
      if (attempt >= maxRetries) throw error
      await sleep(computeBackoff(attempt))
      continue
    }

    if (response.ok) return response
    if (!isRetryableStatus(response.status) || attempt >= maxRetries) {
      throw await errorFromResponse(response)
    }

    await sleep(computeBackoff(attempt, response.headers.get("Retry-After")))
  }
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}
