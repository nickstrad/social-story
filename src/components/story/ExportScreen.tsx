"use client"

import { useRouter } from "next/navigation"
import { LayoutTemplateIcon } from "lucide-react"
import { toast } from "sonner"
import { ExportPanel } from "./ExportPanel"
import { StoryFlowFooter } from "./StoryFlowFooter"
import { StoryStepsNav } from "./StoryStepsNav"
import { PageHeader } from "@/components/layout/PageHeader"
import { PageLayout } from "@/components/layout/PageLayout"
import { deriveStepStates } from "@/lib/steps"
import { trpc } from "@/lib/trpc"
import { useExport } from "@/hooks/useExport"
import { Button } from "@/components/ui/button"

export function ExportScreen({ storyId }: { storyId: string }) {
  const router = useRouter()
  const utils = trpc.useUtils()
  const [story] = trpc.story.get.useSuspenseQuery({ storyId })
  const { readyPages, missingPages, taskState, taskError, pdfUrl, onExport } =
    useExport(storyId)
  const createTemplate = trpc.template.createFromStory.useMutation({
    onSuccess: async ({ storyId: templateId }) => {
      await utils.template.list.invalidate()
      toast.success("Template created — your original story is unchanged")
      router.push(`/stories/${templateId}/characters?template=1`)
    },
    onError: (error) => toast.error(error.message),
  })

  const steps = deriveStepStates({
    kind: story.kind,
    status: story.status,
    script: story.script,
    charactersCount: story.counts.characters,
    baseImageUrl: story.baseImageUrl,
    pagesCount: story.counts.pages,
    pagesWithImageCount: story.counts.pagesWithImage,
  })

  return (
    <PageLayout width="form" spacing="relaxed">
      <StoryStepsNav
        storyId={storyId}
        steps={steps}
        current="export"
        kind={story.kind}
      />
      <PageHeader
        title="Export"
        description="Turn your finished story into a downloadable PDF."
        actions={
          <Button
            variant="outline"
            disabled={createTemplate.isPending}
            onClick={() => createTemplate.mutate({ storyId })}
          >
            <LayoutTemplateIcon />
            {createTemplate.isPending ? "Converting…" : "Convert to template"}
          </Button>
        }
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
      <StoryFlowFooter
        storyId={storyId}
        steps={steps}
        current="export"
        kind={story.kind}
      />
    </PageLayout>
  )
}
