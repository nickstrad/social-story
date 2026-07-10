import { QueryClientProvider } from "@tanstack/react-query"
import { httpBatchLink } from "@trpc/client"
import { Suspense, type ReactNode } from "react"
import superjson from "superjson"

import { createQueryClient } from "@/lib/query-client"
import { trpc } from "@/lib/trpc"

const missingMockFetch: typeof globalThis.fetch = () =>
  Promise.reject(
    new Error("createHookWrapper requires a mock fetch implementation")
  )

export function createHookWrapper({
  fetch: fetchImplementation = missingMockFetch,
  fallback = <div>Loading…</div>,
}: {
  fetch?: typeof globalThis.fetch
  fallback?: ReactNode
} = {}) {
  const queryClient = createQueryClient()
  const client = trpc.createClient({
    links: [
      httpBatchLink({
        transformer: superjson,
        url: "http://localhost/api/trpc",
        fetch: fetchImplementation,
      }),
    ],
  })

  return function HookWrapper({ children }: { children: ReactNode }) {
    return (
      <trpc.Provider client={client} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={fallback}>{children}</Suspense>
        </QueryClientProvider>
      </trpc.Provider>
    )
  }
}
