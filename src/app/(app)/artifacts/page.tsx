import { Suspense } from "react"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { ArtifactsScreen } from "@/components/artifacts/ArtifactsScreen"
import { ArtifactsSkeleton } from "@/components/artifacts/ArtifactsSkeleton"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc-server"

export default function ArtifactsPage() {
  prefetch(
    trpc.artifact.list.prefetchInfinite({
      sort: { field: "createdAt", dir: "desc" },
    })
  )
  return (
    <HydrateClient>
      <ErrorBoundary fallbackTitle="Could not load artifacts">
        <Suspense fallback={<ArtifactsSkeleton />}>
          <ArtifactsScreen />
        </Suspense>
      </ErrorBoundary>
    </HydrateClient>
  )
}
