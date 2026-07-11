import { Suspense } from "react"
import { CharactersScreen } from "@/components/characters/CharactersScreen"
import { CharactersSkeleton } from "@/components/characters/CharactersSkeleton"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc-server"

export default async function CharactersPage({
  params,
}: {
  params: Promise<{ storyId: string }>
}) {
  const { storyId } = await params
  prefetch(trpc.story.get.prefetch({ storyId }))
  prefetch(trpc.character.listForStory.prefetch({ storyId }))
  prefetch(trpc.rule.listForStory.prefetch({ storyId }))
  return (
    <HydrateClient>
      <ErrorBoundary fallbackTitle="Could not load characters">
        <Suspense fallback={<CharactersSkeleton />}>
          <CharactersScreen storyId={storyId} />
        </Suspense>
      </ErrorBoundary>
    </HydrateClient>
  )
}
