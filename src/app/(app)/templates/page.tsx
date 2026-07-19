import { Suspense } from "react"

import { ErrorBoundary } from "@/components/ErrorBoundary"
import { TemplatesScreen } from "@/components/templates/TemplatesScreen"
import { TemplatesSkeleton } from "@/components/templates/TemplatesSkeleton"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc-server"

export default function TemplatesPage() {
  prefetch(
    trpc.template.list.prefetchInfinite({
      sort: { field: "createdAt", dir: "desc" },
    })
  )
  prefetch(
    trpc.library.characters.list.prefetchInfinite({
      sort: { field: "createdAt", dir: "desc" },
    })
  )
  return (
    <HydrateClient>
      <ErrorBoundary fallbackTitle="Could not load templates">
        <Suspense fallback={<TemplatesSkeleton />}>
          <TemplatesScreen />
        </Suspense>
      </ErrorBoundary>
    </HydrateClient>
  )
}
