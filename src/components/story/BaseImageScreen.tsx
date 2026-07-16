"use client"

import { BaseImagePanel } from "./BaseImagePanel"
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
    <div className="mx-auto grid max-w-3xl gap-6">
      <div className="grid gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Base image</h1>
        <p className="text-muted-foreground">
          Generate the reference sheet that keeps your characters consistent
          across every page.
        </p>
      </div>
      <BaseImagePanel
        storyId={storyId}
        imageUrl={imageUrl}
        taskState={taskState}
        taskError={taskError}
        characterCount={characters.length}
        canGenerate={canGenerate}
        onGenerate={onGenerate}
      />
    </div>
  )
}
