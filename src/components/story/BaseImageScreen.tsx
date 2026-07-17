"use client"

import { BaseImagePanel } from "./BaseImagePanel"
import { PageHeader } from "@/components/layout/PageHeader"
import { PageLayout } from "@/components/layout/PageLayout"
import { useBaseImage } from "@/hooks/useBaseImage"

export function BaseImageScreen({ storyId }: { storyId: string }) {
  const {
    characters,
    imageUrl,
    taskState,
    taskError,
    canGenerate,
    onGenerate,
  } = useBaseImage(storyId)

  return (
    <PageLayout width="form">
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
    </PageLayout>
  )
}
