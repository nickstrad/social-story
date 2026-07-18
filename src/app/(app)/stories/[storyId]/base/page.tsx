import { Suspense } from "react"

import { BaseImageScreen } from "@/components/story/BaseImageScreen"
import { BaseImageSkeleton } from "@/components/story/BaseImageSkeleton"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc-server"

export default async function BaseImagePage({
  params,
}: {
  params: Promise<{ storyId: string }>
}) {
  const { storyId } = await params
  prefetch(trpc.story.get.prefetch({ storyId }))
  prefetch(trpc.story.baseImageSources.prefetch({ storyId }))
  prefetch(trpc.character.listForStory.prefetch({ storyId }))
  return (
    <HydrateClient>
      <ErrorBoundary fallbackTitle="Could not load base image">
        <Suspense fallback={<BaseImageSkeleton />}>
          <BaseImageScreen storyId={storyId} />
        </Suspense>
      </ErrorBoundary>
    </HydrateClient>
  )
}
