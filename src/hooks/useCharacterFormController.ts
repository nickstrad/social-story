"use client"

import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import type { z } from "zod"

import { characterPhotoAutofillSchema } from "@/server/ai"
import { characterInputSchema } from "@/server/domain/schemas"
import { validateUpload } from "@/server/domain/upload"

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

type CharacterInput = z.infer<typeof characterInputSchema>

interface CharacterFormSource {
  name: string
  role: string | null
  age: string | null
  appearance: string | null
  photoDescription: string | null
  photoUrl: string | null
}

const emptyValues: CharacterValues = {
  name: "",
  role: "",
  age: "",
  appearance: "",
  photoDescription: "",
}

function valuesFor(character?: CharacterFormSource): CharacterValues {
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

export function useCharacterFormController({
  character,
  storyId,
  isPending,
  save,
  invalidate,
  uploadUrl,
  uploadIdField,
  successMessage,
  failureMessage,
}: {
  character?: CharacterFormSource
  storyId?: string
  isPending: boolean
  save: (values: CharacterInput) => Promise<{ id: string }>
  invalidate: () => Promise<unknown>
  uploadUrl: string
  uploadIdField: string
  successMessage: string
  failureMessage: string
}) {
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
      if (file && photoPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(photoPreviewUrl)
      }
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
      setErrors((current) => ({ ...current, photo: validation.error }))
      return
    }
    if (photoPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(photoPreviewUrl)
    }
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
        storyId ? { storyId, file } : { file },
        "Could not auto-fill from this photo"
      )
      const details = characterPhotoAutofillSchema.parse(payload)
      setValues((current) => ({ ...current, ...details }))
      setAutofillState("idle")
      toast.success("Appearance details added — review them before saving")
    } catch (error) {
      setAutofillState("error")
      setErrors((current) => ({
        ...current,
        photo: errorMessage(error, "Could not auto-fill from this photo"),
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
      const saved = await save(parsed.data)
      if (file) {
        setUploadState("uploading")
        await postMultipart(
          uploadUrl,
          {
            ...(storyId ? { storyId } : {}),
            [uploadIdField]: saved.id,
            file,
          },
          "Photo upload failed"
        )
        await invalidate()
      }
      setUploadState("idle")
      toast.success(successMessage)
      return saved
    } catch (error) {
      setUploadState("error")
      setErrors({ form: errorMessage(error, failureMessage) })
    }
  }

  return {
    values,
    errors,
    photoPreviewUrl,
    uploadState,
    autofillState,
    canAutofill: Boolean(file) && autofillState !== "loading",
    isSubmitting: isPending || uploadState === "uploading",
    onChange,
    onPickFile,
    onAutofill,
    onSubmit,
  }
}
