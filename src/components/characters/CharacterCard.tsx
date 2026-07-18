"use client"

import Image from "next/image"
import { PencilIcon, SaveIcon, Trash2Icon } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface CharacterCardCharacter {
  name: string
  role: string | null
  age: string | null
  appearance: string | null
  photoDescription: string | null
  photoUrl: string | null
}

export function CharacterCard({
  character,
  imagePending = false,
  onEdit,
  onDelete,
  onSaveToLibrary,
}: {
  character: CharacterCardCharacter
  imagePending?: boolean
  onEdit: () => void
  onDelete: () => void
  onSaveToLibrary?: () => void
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start gap-4">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted">
          {imagePending ? (
            <Skeleton className="size-full" />
          ) : character.photoUrl ? (
            <Image
              unoptimized
              src={character.photoUrl}
              alt={character.name}
              fill
              sizes="80px"
              className="object-cover"
            />
          ) : (
            <Avatar className="size-full rounded-xl">
              <AvatarFallback className="rounded-xl text-xl">
                {character.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <CardTitle>{character.name}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {[character.role, character.age].filter(Boolean).join(" · ") ||
              "No metadata yet"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Edit ${character.name}`}
          onClick={onEdit}
        >
          <PencilIcon />
        </Button>
        {onSaveToLibrary && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Save ${character.name} to library`}
            onClick={onSaveToLibrary}
          >
            <SaveIcon />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete ${character.name}`}
          onClick={onDelete}
        >
          <Trash2Icon />
        </Button>
      </CardHeader>
      {(character.appearance || character.photoDescription) && (
        <CardContent className="space-y-2 text-sm">
          <p>{character.appearance}</p>
          <p className="text-muted-foreground">{character.photoDescription}</p>
        </CardContent>
      )}
    </Card>
  )
}
