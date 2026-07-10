"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon } from "lucide-react"
import { StoryList } from "./StoryList"
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
import { Button } from "@/components/ui/button"
import { useStories } from "@/hooks/useStories"
import type { Story } from "@/server/domain/types"

export function StoriesScreen() {
  const router = useRouter()
  const { stories, remove } = useStories()
  const [deleteTarget, setDeleteTarget] = useState<Story>()

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Your stories
          </h1>
          <p className="text-muted-foreground">
            Turn a social-story script into an illustrated picture book.
          </p>
        </div>
        <Button onClick={() => router.push("/stories/new")}>
          <PlusIcon />
          New story
        </Button>
      </div>

      <StoryList
        stories={stories}
        onNew={() => router.push("/stories/new")}
        onDelete={setDeleteTarget}
      />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(undefined)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget?.title.trim() || "this story"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the story, its pages, characters, and
              generated images. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) remove.mutate({ storyId: deleteTarget.id })
                setDeleteTarget(undefined)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
