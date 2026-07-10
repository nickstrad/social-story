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
import type { TaskStatus } from "@/server/domain/types"

function isBusy(taskState?: TaskStatus): boolean {
  return taskState === "PENDING" || taskState === "RUNNING"
}

export function BaseImagePanel({
  storyId,
  imageUrl,
  taskState,
  characterCount,
  canGenerate,
  onGenerate,
}: {
  storyId: string
  imageUrl?: string
  taskState?: TaskStatus
  characterCount: number
  canGenerate: boolean
  onGenerate: () => void
}) {
  const [imageLoading, setImageLoading] = useState(Boolean(imageUrl))
  const busy = isBusy(taskState)

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
        {taskState && <TaskStatusBadge status={taskState} />}
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
                {imageUrl ? "Regenerate" : "Generate base image"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
