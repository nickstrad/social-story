"use client"

import { useState } from "react"

import { PageFocusEditor } from "./PageFocusEditor"
import { PageGrid } from "./PageGrid"
import { PageGridToolbar } from "./PageGridToolbar"
import { PageHeader } from "@/components/layout/PageHeader"
import { PageLayout } from "@/components/layout/PageLayout"
import { StoryStepsNav } from "@/components/story/StoryStepsNav"
import { StoryFlowFooter } from "@/components/story/StoryFlowFooter"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { effectiveCharacters, type EditorPage } from "@/lib/pagesEditor"
import { toggle } from "@/lib/selection"
import { deriveStepStates } from "@/lib/steps"
import type { ClientCharacter as Character, Rule } from "@/server/domain/types"
import { trpc } from "@/lib/trpc"
import { usePageForm } from "@/hooks/usePageForm"
import { usePageGeneration } from "@/hooks/usePageGeneration"
import { usePagesEditor } from "@/hooks/usePagesEditor"

type Editor = ReturnType<typeof usePagesEditor>

/** Label a page for the UI: "Cover" or its 1-based content position. */
function pageLabel(page: EditorPage, pages: EditorPage[]): string {
  if (page.kind === "COVER") return "Cover"
  const index = pages.filter((p) => p.kind === "PAGE").indexOf(page)
  return `Page ${index + 1}`
}

// Remounted per focused page (keyed on page.id), so the draft form and its
// generation subscription reset cleanly when the author moves between pages.
function FocusEditor({
  editor,
  page,
  storyId,
  characters,
  rules,
  onRequestDelete,
}: {
  editor: Editor
  page: EditorPage
  storyId: string
  characters: Character[]
  rules: Rule[]
  onRequestDelete: (page: EditorPage) => void
}) {
  const form = usePageForm(page)
  const generation = usePageGeneration(page.id, storyId)
  const imagesQuery = trpc.page.listImages.useQuery({ pageId: page.id })
  const images = imagesQuery.data ?? []

  const currentImageUrl =
    images.find((image) => image.id === page.selectedImageId)?.url ??
    page.selectedImageUrl ??
    generation.latestImageUrl ??
    null

  const toggleCharacter = (characterId: string) =>
    editor.setCharacters(page.id, [
      ...toggle(new Set(page.characterIds), characterId),
    ])

  return (
    <PageFocusEditor
      page={page}
      pageNumber={pageLabel(page, editor.pages)}
      genState={generation.state}
      genError={generation.error}
      currentImageUrl={currentImageUrl}
      images={images}
      imagesLoading={imagesQuery.isLoading}
      form={form}
      characters={characters}
      effectiveCharacterIds={effectiveCharacters(page, rules, characters)}
      hasPrev={editor.hasPrev}
      hasNext={editor.hasNext}
      onGenerate={() => generation.generate(form.steering)}
      onSelectVariant={(pageImageId) =>
        editor.selectImage(page.id, pageImageId)
      }
      onToggleCharacter={toggleCharacter}
      onToggleHidden={(hidden) => editor.setHidden(page.id, hidden)}
      onDelete={() => onRequestDelete(page)}
      onPrev={editor.goPrev}
      onNext={editor.goNext}
      onClose={editor.closeFocus}
    />
  )
}

export function PagesEditorScreen({
  storyId,
  initialFocusedPageId = null,
}: {
  storyId: string
  initialFocusedPageId?: string | null
}) {
  const editor = usePagesEditor(storyId, initialFocusedPageId)
  const [deleteTarget, setDeleteTarget] = useState<EditorPage | null>(null)

  const steps = deriveStepStates({
    status: editor.story.status,
    script: editor.story.script,
    charactersCount: editor.story.counts.characters,
    baseImageUrl: editor.story.baseImageUrl,
    pagesCount: editor.story.counts.pages,
    pagesWithImageCount: editor.story.counts.pagesWithImage,
  })

  return (
    <PageLayout width="app" spacing="relaxed">
      <StoryStepsNav storyId={storyId} steps={steps} current="pages" />

      {editor.focusedPage ? (
        <FocusEditor
          key={editor.focusedPage.id}
          editor={editor}
          page={editor.focusedPage}
          storyId={storyId}
          characters={editor.characters}
          rules={editor.rules}
          onRequestDelete={setDeleteTarget}
        />
      ) : (
        <div className="grid gap-page">
          <PageHeader
            title="Pages"
            description="Generate every page in bulk, or open one to edit and refine it."
          />
          <PageGridToolbar
            selectedCount={editor.selection.size}
            isAllSelected={editor.isAllSelected}
            progress={editor.bulkProgress}
            busy={editor.bulkGenerating}
            onSelectAll={editor.selectAll}
            onSelectNone={editor.selectNone}
            onGenerate={editor.generateSelected}
            onAddPage={() => editor.addPage()}
          />
          <PageGrid
            pages={editor.pages}
            selection={editor.selection}
            genStates={editor.genStates}
            onToggleSelect={editor.toggleSelect}
            onFocus={editor.focus}
            onMove={editor.movePage}
          />
        </div>
      )}

      <StoryFlowFooter storyId={storyId} steps={steps} current="pages" />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this page?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the page and its generated images. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) editor.removePage(deleteTarget.id)
                setDeleteTarget(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  )
}
