"use client"

import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { characterPhotoAutofillSchema } from "@/server/ai"
import { characterInputSchema } from "@/server/domain/schemas"
import { validateUpload } from "@/server/domain/upload"
import type { ClientCharacter as Character } from "@/server/domain/types"
import { useCharacters } from "./useCharacters"

export type CharacterValues = {
  name: string
  role: string
  age: string
  appearance: string
  photoDescription: string
}
export type CharacterErrors = Partial<
  Record<keyof CharacterValues | "form" | "photo", string>
>
const emptyValues: CharacterValues = {
  name: "",
  role: "",
  age: "",
  appearance: "",
  photoDescription: "",
}
const AUTOFILL_ERROR = "Could not auto-fill from this photo"

function valuesFor(character?: Character): CharacterValues {
  if (!character) return emptyValues
  return {
    name: character.name,
    role: character.role ?? "",
    age: character.age ?? "",
    appearance: character.appearance ?? "",
    photoDescription: character.photoDescription ?? "",
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function apiError(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object" || !("error" in payload)) return
  return typeof payload.error === "string" ? payload.error : undefined
}

async function postMultipart(
  url: string,
  fields: Record<string, string | File>,
  fallbackError: string
): Promise<unknown> {
  const body = new FormData()
  for (const [key, value] of Object.entries(fields)) body.set(key, value)
  const response = await fetch(url, { method: "POST", body })
  const payload: unknown = await response.json()
  if (!response.ok) throw new Error(apiError(payload) ?? fallbackError)
  return payload
}

export function useCharacterForm(storyId: string, character?: Character) {
  const { create, update, invalidate } = useCharacters(storyId)
  const [values, setValues] = useState<CharacterValues>(() =>
    valuesFor(character)
  )
  const [errors, setErrors] = useState<CharacterErrors>({})
  const [file, setFile] = useState<File>()
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState(
    character?.photoUrl ?? ""
  )
  const [uploadState, setUploadState] = useState<
    "idle" | "uploading" | "error"
  >("idle")
  const [autofillState, setAutofillState] = useState<
    "idle" | "loading" | "error"
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
    const validation = validateUpload({
      mimeType: picked.type,
      size: picked.size,
    })
    if (!validation.valid) {
      setErrors((current) => ({
        ...current,
        photo: validation.error,
      }))
      return
    }
    if (photoPreviewUrl.startsWith("blob:"))
      URL.revokeObjectURL(photoPreviewUrl)
    setFile(picked)
    setPhotoPreviewUrl(URL.createObjectURL(picked))
    setAutofillState("idle")
    setErrors((current) => ({ ...current, photo: undefined, form: undefined }))
  }
  async function onAutofill() {
    if (!file || autofillState === "loading") return
    setAutofillState("loading")
    setErrors((current) => ({ ...current, photo: undefined, form: undefined }))
    try {
      const payload = await postMultipart(
        "/api/describe/photo",
        { storyId, file },
        AUTOFILL_ERROR
      )
      const details = characterPhotoAutofillSchema.parse(payload)
      setValues((current) => ({ ...current, ...details }))
      setAutofillState("idle")
      toast.success("Appearance details added — review them before saving")
    } catch (cause) {
      setAutofillState("error")
      setErrors((current) => ({
        ...current,
        photo: errorMessage(cause, AUTOFILL_ERROR),
      }))
    }
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
        await postMultipart(
          "/api/upload/photo",
          { storyId, characterId: saved.id, file },
          "Photo upload failed"
        )
        await invalidate()
      }
      setUploadState("idle")
      toast.success(character ? "Character updated" : "Character added")
      return saved
    } catch (cause) {
      setUploadState("error")
      setErrors({
        form: errorMessage(cause, "Could not save character"),
      })
    }
  }
  return {
    values,
    errors,
    photoPreviewUrl,
    uploadState,
    autofillState,
    canAutofill: Boolean(file) && autofillState !== "loading",
    isSubmitting:
      create.isPending || update.isPending || uploadState === "uploading",
    onChange,
    onPickFile,
    onAutofill,
    onSubmit,
  }
}
