import { Suspense } from "react"

import { PagesEditorScreen } from "@/components/pages/PagesEditorScreen"
import { PagesEditorSkeleton } from "@/components/pages/PagesEditorSkeleton"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc-server"

export default async function PagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ storyId: string }>
  searchParams: Promise<{ focus?: string; template?: string }>
}) {
  const { storyId } = await params
  const { focus, template } = await searchParams
  const storyKind = template === "1" ? "TEMPLATE" : "STORY"
  prefetch(trpc.story.get.prefetch({ storyId, kind: storyKind }))
  // Deep-linked into a specific page: warm its variant list too.
  if (focus) prefetch(trpc.page.listImages.prefetch({ pageId: focus }))

  return (
    <HydrateClient>
      <ErrorBoundary fallbackTitle="Could not load pages">
        <Suspense fallback={<PagesEditorSkeleton />}>
          <PagesEditorScreen
            storyId={storyId}
            initialFocusedPageId={focus ?? null}
            storyKind={storyKind}
          />
        </Suspense>
      </ErrorBoundary>
    </HydrateClient>
  )
}
