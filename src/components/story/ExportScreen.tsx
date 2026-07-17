"use client"

import { ExportPanel } from "./ExportPanel"
import { StoryStepsNav } from "./StoryStepsNav"
import { PageHeader } from "@/components/layout/PageHeader"
import { PageLayout } from "@/components/layout/PageLayout"
import { deriveStepStates } from "@/lib/steps"
import { trpc } from "@/lib/trpc"
import { useExport } from "@/hooks/useExport"

export function ExportScreen({ storyId }: { storyId: string }) {
  const [story] = trpc.story.get.useSuspenseQuery({ storyId })
  const { readyPages, missingPages, taskState, taskError, pdfUrl, onExport } =
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
    <PageLayout width="form" spacing="relaxed">
      <StoryStepsNav storyId={storyId} steps={steps} current="export" />
      <PageHeader
        title="Export"
        description="Turn your finished story into a downloadable PDF."
      />
      <ExportPanel
        storyId={storyId}
        readyPages={readyPages}
        missingPages={missingPages}
        taskState={taskState}
        taskError={taskError}
        pdfUrl={pdfUrl}
        onExport={onExport}
      />
    </PageLayout>
  )
}
