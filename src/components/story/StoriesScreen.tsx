"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon } from "lucide-react"
import { StoryList } from "./StoryList"
import { PageHeader } from "@/components/layout/PageHeader"
import { PageLayout } from "@/components/layout/PageLayout"
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
    <PageLayout>
      <PageHeader
        title="Your stories"
        description="Turn a social-story script into an illustrated picture book."
        actions={
          <Button onClick={() => router.push("/stories/new")}>
            <PlusIcon />
            New story
          </Button>
        }
      />

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
    </PageLayout>
  )
}
