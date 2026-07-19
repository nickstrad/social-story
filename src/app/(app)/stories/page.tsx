import { Suspense } from "react"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { StoriesScreen } from "@/components/story/StoriesScreen"
import { StoryListSkeleton } from "@/components/story/StoryListSkeleton"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc-server"

export default function StoriesPage() {
  prefetch(
    trpc.story.list.prefetchInfinite({
      sort: { field: "createdAt", dir: "desc" },
    })
  )
  return (
    <HydrateClient>
      <ErrorBoundary fallbackTitle="Could not load stories">
        <Suspense fallback={<StoryListSkeleton />}>
          <StoriesScreen />
        </Suspense>
      </ErrorBoundary>
    </HydrateClient>
  )
}
