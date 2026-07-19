"use client"

import { ScriptEditor } from "./ScriptEditor"
import { StoryFlowFooter } from "./StoryFlowFooter"
import { StoryStepsNav } from "./StoryStepsNav"
import { deriveStepStates } from "@/lib/steps"
import { trpc } from "@/lib/trpc"
import { useScriptEditor } from "@/hooks/useScriptEditor"
import type { StoryKind } from "@/server/domain/types"

export function ScriptScreen({
  storyId,
  storyKind,
}: {
  storyId: string
  storyKind: StoryKind
}) {
  const [story] = trpc.story.get.useSuspenseQuery({ storyId, kind: storyKind })
  const editor = useScriptEditor(storyId, storyKind)

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
    // No width here: the steps nav and the editor each own their own frame.
    <div className="grid gap-page-relaxed">
      <StoryStepsNav
        storyId={storyId}
        steps={steps}
        current="script"
        kind={story.kind}
      />
      <ScriptEditor
        title={editor.title}
        script={editor.script}
        onChangeTitle={editor.onChangeTitle}
        onChangeScript={editor.onChangeScript}
      />
      <StoryFlowFooter
        storyId={storyId}
        steps={steps}
        current="script"
        kind={story.kind}
      />
    </div>
  )
}
