import { Suspense } from "react"

import { BaseImageScreen } from "@/components/story/BaseImageScreen"
import { BaseImageSkeleton } from "@/components/story/BaseImageSkeleton"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc-server"

export default async function BaseImagePage({
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
  prefetch(trpc.story.baseImageSources.prefetch({ storyId }))
  prefetch(trpc.character.listForStory.prefetch({ storyId }))
  return (
    <HydrateClient>
      <ErrorBoundary fallbackTitle="Could not load base image">
        <Suspense fallback={<BaseImageSkeleton />}>
          <BaseImageScreen storyId={storyId} storyKind={storyKind} />
        </Suspense>
      </ErrorBoundary>
    </HydrateClient>
  )
}
