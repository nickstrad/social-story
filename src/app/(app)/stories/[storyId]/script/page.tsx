import { Suspense } from "react"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { ScriptEditorSkeleton } from "@/components/story/ScriptEditorSkeleton"
import { ScriptScreen } from "@/components/story/ScriptScreen"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc-server"

export default async function ScriptPage({
  params,
  searchParams,
}: {
  params: Promise<{ storyId: string }>
  searchParams: Promise<{ template?: string }>
}) {
  const { storyId } = await params
  const { template } = await searchParams
  const storyKind = template === "1" ? "TEMPLATE" : "STORY"
  prefetch(trpc.story.get.prefetch({ storyId, kind: storyKind }))
  return (
    <HydrateClient>
      <ErrorBoundary fallbackTitle="Could not load story">
        <Suspense fallback={<ScriptEditorSkeleton />}>
          <ScriptScreen storyId={storyId} storyKind={storyKind} />
        </Suspense>
      </ErrorBoundary>
    </HydrateClient>
  )
}
