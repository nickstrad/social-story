"use client"

import { BaseImagePanel } from "./BaseImagePanel"
import { StoryFlowFooter } from "./StoryFlowFooter"
import { StoryStepsNav } from "./StoryStepsNav"
import { PageHeader } from "@/components/layout/PageHeader"
import { PageLayout } from "@/components/layout/PageLayout"
import { useBaseImage } from "@/hooks/useBaseImage"
import { deriveStepStates } from "@/lib/steps"

export function BaseImageScreen({ storyId }: { storyId: string }) {
  const {
    story,
    characters,
    imageUrl,
    taskState,
    taskError,
    canGenerate,
    onGenerate,
  } = useBaseImage(storyId)
  const steps = deriveStepStates({
    status: story.status,
    script: story.script,
    charactersCount: characters.length,
    baseImageUrl: story.baseImageUrl,
    pagesCount: story.counts.pages,
    pagesWithImageCount: story.counts.pagesWithImage,
  })

  return (
    <PageLayout width="form" spacing="relaxed">
      <StoryStepsNav storyId={storyId} steps={steps} current="base" />
      <PageHeader
        title="Base image"
        description="Generate the reference sheet that keeps your characters consistent across every page."
      />
      <BaseImagePanel
        storyId={storyId}
        imageUrl={imageUrl}
        taskState={taskState}
        taskError={taskError}
        characterCount={characters.length}
        canGenerate={canGenerate}
        onGenerate={onGenerate}
      />
      <StoryFlowFooter storyId={storyId} steps={steps} current="base" />
    </PageLayout>
  )
}
