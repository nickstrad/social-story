import { Suspense } from "react"

import { ErrorBoundary } from "@/components/ErrorBoundary"
import { TemplatesScreen } from "@/components/templates/TemplatesScreen"
import { TemplatesSkeleton } from "@/components/templates/TemplatesSkeleton"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc-server"

export default function TemplatesPage() {
  prefetch(trpc.template.list.prefetch())
  prefetch(trpc.library.characters.list.prefetch())
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
