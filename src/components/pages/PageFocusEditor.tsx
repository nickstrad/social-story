"use client"

import { useEffect, useRef, useState } from "react"
import { XIcon } from "lucide-react"

import { PageCharacterChips } from "./PageCharacterChips"
import { PageImageDropzone } from "./PageImageDropzone"
import { PageMetaForm } from "./PageMetaForm"
import { SteeringBox } from "./SteeringBox"
import { VariantStrip } from "./VariantStrip"
import { TaskStatusBadge } from "@/components/tasks/TaskStatusBadge"
import { Button } from "@/components/ui/button"
import type { PageImageUploadState } from "@/hooks/usePageImageUpload"
import type { PageGenState } from "@/hooks/usePageGeneration"
import type { CharacterChip, EditorPage } from "@/lib/pagesEditor"
import type { ClientPageImage as PageImage } from "@/server/domain/types"

export interface PageFocusForm {
  text: string
  imagePrompt: string
  steering: string
  onChangeText: (value: string) => void
  onChangeImagePrompt: (value: string) => void
  onChangeSteering: (value: string) => void
}

interface Uploader {
  state: PageImageUploadState
  validateFile: (file: File) => boolean
  upload: (file: File) => Promise<boolean>
}

export function PageFocusEditor({
  page,
  pageNumber,
  genState,
  genError,
  currentImageUrl,
  currentImageSource,
  images,
  imagesLoading,
  form,
  characterChips,
  hasPrev,
  hasNext,
  onGenerate,
  upload,
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
  currentImageSource?: PageImage["source"]
  images: PageImage[]
  imagesLoading: boolean
  form: PageFocusForm
  characterChips: CharacterChip[]
  hasPrev: boolean
  hasNext: boolean
  onGenerate: () => void
  upload: Uploader
  onSelectVariant: (pageImageId: string) => void
  onToggleCharacter: (characterId: string) => void
  onToggleHidden: (hidden: boolean) => void
  onDelete: () => void
  onPrev: () => void
  onNext: () => void
  onClose: () => void
}) {
  const generationBusy = genState === "queued" || genState === "generating"
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    },
    [previewUrl]
  )

  function discardPending() {
    setPreviewUrl(null)
    setPendingFile(null)
  }

  async function uploadFile(file: File) {
    if (await upload.upload(file)) discardPending()
  }

  function takeFile(file: File) {
    if (!upload.validateFile(file)) return
    if (!currentImageUrl) {
      void uploadFile(file)
      return
    }
    discardPending()
    setPendingFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const openPicker = () => inputRef.current?.click()
  const uploading = upload.state === "uploading"
  const busy = generationBusy || uploading

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
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            aria-label="Upload page image"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) takeFile(file)
              event.target.value = ""
            }}
          />
          <PageImageDropzone
            url={currentImageUrl}
            source={currentImageSource}
            generationBusy={generationBusy}
            uploadState={upload.state}
            dragging={dragging}
            previewUrl={previewUrl}
            onDragState={setDragging}
            onDrop={takeFile}
            onOpenPicker={openPicker}
            onConfirm={() => {
              if (pendingFile) void uploadFile(pendingFile)
            }}
            onCancel={discardPending}
          />
          <VariantStrip
            images={images}
            selectedImageId={page.selectedImageId}
            loading={imagesLoading}
            busy={busy}
            onSelect={onSelectVariant}
          />
          <PageCharacterChips
            chips={characterChips}
            isCover={page.kind === "COVER"}
            disabled={busy}
            onToggleCharacter={onToggleCharacter}
          />
          <SteeringBox
            value={form.steering}
            onChange={form.onChangeSteering}
            onGenerate={onGenerate}
            hasImage={Boolean(currentImageUrl)}
            busy={generationBusy}
            uploading={uploading}
            failed={genState === "failed"}
            onUpload={openPicker}
          />
        </div>

        <PageMetaForm
          isCover={page.kind === "COVER"}
          text={form.text}
          imagePrompt={form.imagePrompt}
          onChangeText={form.onChangeText}
          onChangeImagePrompt={form.onChangeImagePrompt}
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
