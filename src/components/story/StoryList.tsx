"use client"

import Link from "next/link"
import { BookOpenIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/ui/icon-button"
import {
  Card,
  CardAction,
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
import { storyTitle } from "@/server/domain/storyTitle"
import type { Story } from "@/server/domain/types"

const statusLabels: Record<Story["status"], string> = {
  DRAFT: "Draft",
  PARSED: "Parsed",
  READY: "Ready",
}

export function StoryList({
  stories,
  onNew,
  onDelete,
}: {
  stories: Story[]
  onNew: () => void
  onDelete: (story: Story) => void
}) {
  if (stories.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BookOpenIcon />
          </EmptyMedia>
          <EmptyTitle>No stories yet</EmptyTitle>
          <EmptyDescription>
            Paste a social-story script to turn it into an illustrated picture
            book.
          </EmptyDescription>
        </EmptyHeader>
        <Button onClick={onNew}>
          <PlusIcon />
          New story
        </Button>
      </Empty>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {stories.map((story) => (
        <Card key={story.id} className="relative">
          <CardHeader>
            <CardTitle className="truncate">
              <Link
                href={`/stories/${story.id}/script`}
                className="after:absolute after:inset-0"
              >
                {storyTitle(story)}
              </Link>
            </CardTitle>
            <CardDescription>
              <Badge variant="secondary">{statusLabels[story.status]}</Badge>
            </CardDescription>
            <CardAction>
              <IconButton
                variant="ghost"
                label="Delete story"
                className="relative z-10"
                onClick={() => onDelete(story)}
              >
                <Trash2Icon />
              </IconButton>
            </CardAction>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}
