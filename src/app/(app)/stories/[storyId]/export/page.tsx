import { Suspense } from "react"

import { ExportScreen } from "@/components/story/ExportScreen"
import { ExportSkeleton } from "@/components/story/ExportSkeleton"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc-server"

export default async function ExportPage({
  params,
}: {
  params: Promise<{ storyId: string }>
}) {
  const { storyId } = await params
  prefetch(trpc.story.get.prefetch({ storyId }))
  prefetch(trpc.pdf.latest.prefetch({ storyId }))
  return (
    <HydrateClient>
      <ErrorBoundary fallbackTitle="Could not load export">
        <Suspense fallback={<ExportSkeleton />}>
          <ExportScreen storyId={storyId} />
        </Suspense>
      </ErrorBoundary>
    </HydrateClient>
  )
}
