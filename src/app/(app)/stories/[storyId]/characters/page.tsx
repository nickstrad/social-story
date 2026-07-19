import { Suspense } from "react"
import { CharactersScreen } from "@/components/characters/CharactersScreen"
import { CharactersSkeleton } from "@/components/characters/CharactersSkeleton"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc-server"

export default async function CharactersPage({
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
  prefetch(trpc.character.listForStory.prefetch({ storyId }))
  prefetch(trpc.rule.listForStory.prefetch({ storyId }))
  prefetch(
    trpc.library.characters.list.prefetchInfinite({
      sort: { field: "createdAt", dir: "desc" },
    })
  )
  return (
    <HydrateClient>
      <ErrorBoundary fallbackTitle="Could not load characters">
        <Suspense fallback={<CharactersSkeleton />}>
          <CharactersScreen storyId={storyId} storyKind={storyKind} />
        </Suspense>
      </ErrorBoundary>
    </HydrateClient>
  )
}
