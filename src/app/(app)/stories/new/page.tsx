import { Suspense } from "react"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { NewStoryScreen } from "@/components/story/NewStoryScreen"
import { ScriptEditorSkeleton } from "@/components/story/ScriptEditorSkeleton"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc-server"

export default function NewStoryPage() {
  // NewStoryScreen suspends on story.list (via useStories) for its create redirect.
  prefetch(trpc.story.list.prefetch())
  return (
    <HydrateClient>
      <ErrorBoundary fallbackTitle="Could not start a new story">
        <Suspense fallback={<ScriptEditorSkeleton />}>
          <NewStoryScreen />
        </Suspense>
      </ErrorBoundary>
    </HydrateClient>
  )
}
