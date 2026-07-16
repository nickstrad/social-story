"use client"

import { XIcon } from "lucide-react"

import { FadeInImage } from "./FadeInImage"
import { PageMetaForm } from "./PageMetaForm"
import { SteeringBox } from "./SteeringBox"
import { VariantStrip } from "./VariantStrip"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { TaskStatusBadge } from "@/components/tasks/TaskStatusBadge"
import type { Character, PageImage } from "@/server/domain/types"
import type { EditorPage } from "@/lib/pagesEditor"
import type { PageGenState } from "@/hooks/usePageGeneration"

export interface PageFocusForm {
  text: string
  imagePrompt: string
  steering: string
  onChangeText: (value: string) => void
  onChangeImagePrompt: (value: string) => void
  onChangeSteering: (value: string) => void
}

function MainImage({ url, busy }: { url: string | null; busy: boolean }) {
  if (busy) {
    return <Skeleton className="aspect-square w-full rounded-lg" />
  }
  if (!url) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground">
        No image yet — generate one to get started.
      </div>
    )
  }
  return (
    <FadeInImage
      src={url}
      alt="Current page image"
      className="aspect-square w-full rounded-lg"
      imageClassName="object-contain"
    />
  )
}

export function PageFocusEditor({
  page,
  pageNumber,
  genState,
  genError,
  currentImageUrl,
  images,
  imagesLoading,
  form,
  characters,
  effectiveCharacterIds,
  hasPrev,
  hasNext,
  onGenerate,
  onSelectVariant,
  onToggleCharacter,
  onToggleHidden,
  onDelete,
  onPrev,
  onNext,
  onClose,
}: {
  page: EditorPage
  pageNumber: string
  genState: PageGenState
  genError?: string
  currentImageUrl: string | null
  images: PageImage[]
  imagesLoading: boolean
  form: PageFocusForm
  characters: Character[]
  effectiveCharacterIds: string[]
  hasPrev: boolean
  hasNext: boolean
  onGenerate: () => void
  onSelectVariant: (pageImageId: string) => void
  onToggleCharacter: (characterId: string) => void
  onToggleHidden: (hidden: boolean) => void
  onDelete: () => void
  onPrev: () => void
  onNext: () => void
  onClose: () => void
}) {
  const busy = genState === "queued" || genState === "generating"

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">{pageNumber}</h2>
          {genState === "failed" && (
            <TaskStatusBadge status="FAILED" error={genError} />
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <XIcon />
          Back to grid
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="grid content-start gap-4">
          <MainImage url={currentImageUrl} busy={busy} />
          <VariantStrip
            images={images}
            selectedImageId={page.selectedImageId}
            loading={imagesLoading}
            busy={busy}
            onSelect={onSelectVariant}
          />
          <SteeringBox
            value={form.steering}
            onChange={form.onChangeSteering}
            onGenerate={onGenerate}
            hasImage={Boolean(currentImageUrl)}
            busy={busy}
            failed={genState === "failed"}
          />
        </div>

        <PageMetaForm
          isCover={page.kind === "COVER"}
          text={form.text}
          imagePrompt={form.imagePrompt}
          onChangeText={form.onChangeText}
          onChangeImagePrompt={form.onChangeImagePrompt}
          characters={characters}
          selectedCharacterIds={page.characterIds}
          effectiveCharacterIds={effectiveCharacterIds}
          onToggleCharacter={onToggleCharacter}
          hidden={page.hidden}
          onToggleHidden={onToggleHidden}
          onDelete={onDelete}
          hasPrev={hasPrev}
          hasNext={hasNext}
          onPrev={onPrev}
          onNext={onNext}
        />
      </div>
    </div>
  )
}
