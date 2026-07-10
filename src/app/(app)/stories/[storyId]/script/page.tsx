import { Suspense } from "react"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { ScriptEditorSkeleton } from "@/components/story/ScriptEditorSkeleton"
import { ScriptScreen } from "@/components/story/ScriptScreen"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc-server"

export default async function ScriptPage({
  params,
}: {
  params: Promise<{ storyId: string }>
}) {
  const { storyId } = await params
  prefetch(trpc.story.get.prefetch({ storyId }))
  return (
    <HydrateClient>
      <ErrorBoundary fallbackTitle="Could not load story">
        <Suspense fallback={<ScriptEditorSkeleton />}>
          <ScriptScreen storyId={storyId} />
        </Suspense>
      </ErrorBoundary>
    </HydrateClient>
  )
}
