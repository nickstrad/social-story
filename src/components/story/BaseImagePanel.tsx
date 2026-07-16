"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { ImageIcon, SparklesIcon } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { TaskStatusBadge } from "@/components/tasks/TaskStatusBadge"
import { isActiveStatus } from "@/server/domain/taskMachine"
import type { TaskStatus } from "@/server/domain/types"

function generationLabel(taskState: TaskStatus | undefined, imageUrl?: string) {
  if (taskState === "FAILED") return "Retry base image"
  return imageUrl ? "Regenerate" : "Generate base image"
}

export function BaseImagePanel({
  storyId,
  imageUrl,
  taskState,
  taskError,
  characterCount,
  canGenerate,
  onGenerate,
}: {
  storyId: string
  imageUrl?: string
  taskState?: TaskStatus
  taskError?: string
  characterCount: number
  canGenerate: boolean
  onGenerate: () => void
}) {
  const [imageLoading, setImageLoading] = useState(Boolean(imageUrl))
  const busy = isActiveStatus(taskState)
  const actionLabel = generationLabel(taskState, imageUrl)

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="grid gap-1">
          <CardTitle>Character reference sheet</CardTitle>
          <CardDescription>
            A single base image of your whole cast, attached to every page so
            everyone stays recognizable.
          </CardDescription>
        </div>
        {taskState && <TaskStatusBadge status={taskState} error={taskError} />}
      </CardHeader>
      <CardContent className="grid gap-4">
        {characterCount === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ImageIcon />
              </EmptyMedia>
              <EmptyTitle>No characters yet</EmptyTitle>
              <EmptyDescription>
                Add at least one character before generating a base image.
              </EmptyDescription>
            </EmptyHeader>
            <Link
              href={`/stories/${storyId}/characters`}
              className={buttonVariants({ variant: "outline" })}
            >
              Go to characters
            </Link>
          </Empty>
        ) : (
          <>
            <div className="relative aspect-square w-full overflow-hidden rounded-xl border bg-muted">
              {busy || (imageUrl && imageLoading) ? (
                <Skeleton className="absolute inset-0 size-full" />
              ) : null}
              {imageUrl && !busy ? (
                <Image
                  src={imageUrl}
                  alt="Character reference sheet"
                  fill
                  sizes="(max-width: 768px) 100vw, 768px"
                  className="object-contain"
                  onLoad={() => setImageLoading(false)}
                />
              ) : !busy ? (
                <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
                  No base image yet
                </div>
              ) : null}
            </div>
            <div className="flex justify-end">
              <Button onClick={onGenerate} disabled={!canGenerate}>
                <SparklesIcon />
                {actionLabel}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
