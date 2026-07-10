import "server-only"

import { createHydrationHelpers } from "@trpc/react-query/rsc"
import { headers } from "next/headers"
import { cache } from "react"

import { createQueryClient } from "@/lib/query-client"
import { appRouter, type AppRouter } from "@/server/api/root"
import { createTRPCContext } from "@/server/api/trpc"

/**
 * RSC usage:
 *
 *   prefetch(trpc.story.get.prefetch({ storyId }))
 *   return <HydrateClient>{clientContent}</HydrateClient>
 *
 * The React caches are request-scoped. Client hooks consume the hydrated query
 * with `useSuspenseQuery`; polling queries continue to use `useQuery`.
 */
const getQueryClient = cache(createQueryClient)
const getContext = cache(async () =>
  createTRPCContext({ headers: await headers() })
)
const caller = appRouter.createCaller(getContext)

export const { trpc, HydrateClient } = createHydrationHelpers<AppRouter>(
  caller,
  getQueryClient
)

export function prefetch(promise: Promise<unknown>): void {
  void promise
}
