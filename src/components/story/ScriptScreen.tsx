"use client"

import { ScriptEditor } from "./ScriptEditor"
import { StoryStepsNav } from "./StoryStepsNav"
import { deriveStepStates } from "@/lib/steps"
import { trpc } from "@/lib/trpc"
import { useScriptEditor } from "@/hooks/useScriptEditor"

export function ScriptScreen({ storyId }: { storyId: string }) {
  const [story] = trpc.story.get.useSuspenseQuery({ storyId })
  const editor = useScriptEditor(storyId)

  const steps = deriveStepStates({
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
      <StoryStepsNav storyId={storyId} steps={steps} current="script" />
      <ScriptEditor
        title={editor.title}
        script={editor.script}
        parseState={editor.parseState}
        pageCount={editor.pageCount}
        error={editor.error}
        canReparse={editor.canReparse}
        onChangeTitle={editor.onChangeTitle}
        onChangeScript={editor.onChangeScript}
        onParse={editor.onParse}
      />
    </div>
  )
}
