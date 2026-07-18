"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeftIcon, ArrowRightIcon, LibraryBigIcon } from "lucide-react"

import { StoryArtifactsSheet } from "./StoryArtifactsSheet"
import { Button } from "@/components/ui/button"
import { Sheet, SheetTrigger } from "@/components/ui/sheet"
import type { StepKey, StepState } from "@/lib/steps"
import { trpc } from "@/lib/trpc"
import type { StoryKind } from "@/server/domain/types"

const hrefFor = (storyId: string, step: StepState, kind: StoryKind) =>
  `/stories/${storyId}/${step.segment}${kind === "TEMPLATE" ? "?template=1" : ""}`

function StepAction({
  storyId,
  step,
  direction,
  kind,
}: {
  storyId: string
  step?: StepState
  direction: "previous" | "next"
  kind: StoryKind
}) {
  if (!step) return <span className="min-w-8" aria-hidden />

  const isNext = direction === "next"
  const label = isNext ? "Continue to " : "Back to "
  const content = (
    <>
      {!isNext && <ArrowLeftIcon />}
      <span className="max-sm:sr-only">{label}</span>
      {step.label}
      {isNext && <ArrowRightIcon />}
    </>
  )

  if (isNext && !step.enabled) {
    return (
      <Button
        disabled
        title={`Complete this step to continue to ${step.label}`}
      >
        {content}
      </Button>
    )
  }
  return (
    <Button
      variant={isNext ? "default" : "ghost"}
      render={<Link href={hrefFor(storyId, step, kind)} />}
    >
      {content}
    </Button>
  )
}

export function StoryFlowFooter({
  storyId,
  steps,
  current,
  kind,
}: {
  storyId: string
  steps: StepState[]
  current: StepKey
  kind: StoryKind
}) {
  const [artifactsOpen, setArtifactsOpen] = useState(false)
  const currentIndex = steps.findIndex((step) => step.key === current)
  const previous = currentIndex > 0 ? steps[currentIndex - 1] : undefined
  const next =
    currentIndex >= 0 && currentIndex < steps.length - 1
      ? steps[currentIndex + 1]
      : undefined
  const snapshot = trpc.artifact.forStory.useQuery(
    { storyId },
    { enabled: artifactsOpen }
  )

  return (
    <Sheet open={artifactsOpen} onOpenChange={setArtifactsOpen}>
      <nav
        aria-label="Story step actions"
        className="sticky bottom-3 z-30 mx-auto flex w-full max-w-form items-center justify-between gap-2 rounded-2xl border bg-background/95 p-2 shadow-lg supports-backdrop-filter:backdrop-blur-md"
      >
        <StepAction
          storyId={storyId}
          step={previous}
          direction="previous"
          kind={kind}
        />

        <SheetTrigger render={<Button variant="outline" />}>
          <LibraryBigIcon />
          View artifacts
        </SheetTrigger>

        <StepAction
          storyId={storyId}
          step={next}
          direction="next"
          kind={kind}
        />
      </nav>
      <StoryArtifactsSheet
        data={snapshot.data}
        loading={snapshot.isLoading || snapshot.isPending}
      />
    </Sheet>
  )
}
