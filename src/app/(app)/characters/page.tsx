import { Suspense } from "react"

import { ErrorBoundary } from "@/components/ErrorBoundary"
import { LibraryScreen } from "@/components/library/LibraryScreen"
import { LibrarySkeleton } from "@/components/library/LibrarySkeleton"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc-server"

export default function CharactersPage() {
  prefetch(trpc.library.characters.list.prefetch())
  return (
    <HydrateClient>
      <ErrorBoundary fallbackTitle="Could not load characters">
        <Suspense fallback={<LibrarySkeleton />}>
          <LibraryScreen />
        </Suspense>
      </ErrorBoundary>
    </HydrateClient>
  )
}
