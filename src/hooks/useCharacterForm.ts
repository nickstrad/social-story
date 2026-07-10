"use client"

import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { characterInputSchema } from "@/server/domain/schemas"
import type { Character } from "@/server/domain/types"
import { useCharacters } from "./useCharacters"

export type CharacterValues = {
  name: string
  role: string
  age: string
  appearance: string
  photoDescription: string
}
export type CharacterErrors = Partial<
  Record<keyof CharacterValues | "form", string>
>
const emptyValues: CharacterValues = {
  name: "",
  role: "",
  age: "",
  appearance: "",
  photoDescription: "",
}

export function useCharacterForm(storyId: string, character?: Character) {
  const { create, update, invalidate } = useCharacters(storyId)
  const [values, setValues] = useState<CharacterValues>(() =>
    character
      ? {
          name: character.name,
          role: character.role ?? "",
          age: character.age ?? "",
          appearance: character.appearance ?? "",
          photoDescription: character.photoDescription ?? "",
        }
      : emptyValues
  )
  const [errors, setErrors] = useState<CharacterErrors>({})
  const [file, setFile] = useState<File>()
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState(
    character?.photoUrl ?? ""
  )
  const [uploadState, setUploadState] = useState<
    "idle" | "uploading" | "error"
  >("idle")

  useEffect(
    () => () => {
      if (file && photoPreviewUrl.startsWith("blob:"))
        URL.revokeObjectURL(photoPreviewUrl)
    },
    [file, photoPreviewUrl]
  )
  const onChange = (field: keyof CharacterValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({
      ...current,
      [field]: undefined,
      form: undefined,
    }))
  }
  const onPickFile = (picked: File) => {
    if (photoPreviewUrl.startsWith("blob:"))
      URL.revokeObjectURL(photoPreviewUrl)
    setFile(picked)
    setPhotoPreviewUrl(URL.createObjectURL(picked))
  }
  async function onSubmit(event?: FormEvent) {
    event?.preventDefault()
    const parsed = characterInputSchema.safeParse(values)
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors
      setErrors(
        Object.fromEntries(
          Object.entries(fields).map(([key, messages]) => [key, messages?.[0]])
        )
      )
      return
    }
    try {
      const saved = character
        ? await update.mutateAsync({
            storyId,
            characterId: character.id,
            character: parsed.data,
          })
        : await create.mutateAsync({ storyId, character: parsed.data })
      if (file) {
        setUploadState("uploading")
        const body = new FormData()
        body.set("storyId", storyId)
        body.set("characterId", saved.id)
        body.set("file", file)
        const response = await fetch("/api/upload/photo", {
          method: "POST",
          body,
        })
        if (!response.ok)
          throw new Error(
            (await response.json()).error ?? "Photo upload failed"
          )
        await invalidate()
      }
      setUploadState("idle")
      toast.success(character ? "Character updated" : "Character added")
      return saved
    } catch (cause) {
      setUploadState("error")
      setErrors({
        form:
          cause instanceof Error ? cause.message : "Could not save character",
      })
    }
  }
  return {
    values,
    errors,
    photoPreviewUrl,
    uploadState,
    isSubmitting:
      create.isPending || update.isPending || uploadState === "uploading",
    onChange,
    onPickFile,
    onSubmit,
  }
}
