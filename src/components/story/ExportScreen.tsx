"use client"

import { ExportPanel } from "./ExportPanel"
import { StoryStepsNav } from "./StoryStepsNav"
import { deriveStepStates } from "@/lib/steps"
import { trpc } from "@/lib/trpc"
import { useExport } from "@/hooks/useExport"

export function ExportScreen({ storyId }: { storyId: string }) {
  const [story] = trpc.story.get.useSuspenseQuery({ storyId })
  const { readyPages, missingPages, taskState, pdfUrl, onExport } =
    useExport(storyId)

  const steps = deriveStepStates({
    status: story.status,
    script: story.script,
    charactersCount: story.counts.characters,
    baseImageUrl: story.baseImageUrl,
    pagesCount: story.counts.pages,
    pagesWithImageCount: story.counts.pagesWithImage,
  })

  return (
    <div className="mx-auto grid max-w-3xl gap-8">
      <StoryStepsNav storyId={storyId} steps={steps} current="export" />
      <div className="grid gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Export</h1>
        <p className="text-muted-foreground">
          Turn your finished story into a downloadable PDF.
        </p>
      </div>
      <ExportPanel
        storyId={storyId}
        readyPages={readyPages}
        missingPages={missingPages}
        taskState={taskState}
        pdfUrl={pdfUrl}
        onExport={onExport}
      />
    </div>
  )
}
