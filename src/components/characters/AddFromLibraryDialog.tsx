"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { LoadMoreButton } from "@/components/collections/LoadMoreButton"
import { Button, buttonVariants } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import { FieldLabel } from "@/components/ui/field"
import type { ClientLibraryCharacter } from "@/server/domain/types"

export function AddFromLibraryDialog({
  open,
  onOpenChange,
  characters,
  existingIds,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  isSubmitting,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  characters: ClientLibraryCharacter[]
  existingIds: Set<string>
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
  isSubmitting: boolean
  onSubmit: (ids: string[]) => Promise<void>
}) {
  const [selected, setSelected] = useState<string[]>([])

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setSelected([])
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add from library</DialogTitle>
          <DialogDescription>
            Choose one or more saved characters to copy into this story.
          </DialogDescription>
        </DialogHeader>
        {characters.length ? (
          <div className="grid max-h-[60dvh] gap-2 overflow-y-auto py-1">
            {characters.map((character) => {
              const exists = existingIds.has(character.id)
              const checked = exists || selected.includes(character.id)
              return (
                <FieldLabel
                  key={character.id}
                  className="rounded-xl border p-3 font-normal"
                >
                  <Checkbox
                    checked={checked}
                    disabled={exists}
                    onCheckedChange={(next) =>
                      setSelected((current) =>
                        next
                          ? [...current, character.id]
                          : current.filter((id) => id !== character.id)
                      )
                    }
                  />
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {character.photoUrl ? (
                      <Image
                        unoptimized
                        src={character.photoUrl}
                        alt=""
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    ) : (
                      <Avatar className="size-full rounded-lg">
                        <AvatarFallback className="rounded-lg">
                          {character.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {character.name}
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {exists
                        ? "Already in this story"
                        : [character.role, character.age]
                            .filter(Boolean)
                            .join(" · ") || "Ready to add"}
                    </span>
                  </span>
                </FieldLabel>
              )
            })}
            <LoadMoreButton
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              onClick={onLoadMore}
            />
          </div>
        ) : (
          <Empty>
            <EmptyTitle>Your library is empty</EmptyTitle>
            <EmptyDescription>
              Save a character first, then return here to add them.
            </EmptyDescription>
            <Link
              href="/characters"
              className={buttonVariants({ variant: "outline" })}
            >
              Go to characters
            </Link>
          </Empty>
        )}
        {characters.length > 0 && (
          <DialogFooter>
            <Button
              disabled={selected.length === 0 || isSubmitting}
              onClick={async () => {
                try {
                  await onSubmit(selected)
                  onOpenChange(false)
                } catch {
                  // The mutation owns its error toast; keep the dialog open.
                }
              }}
            >
              Add selected
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
