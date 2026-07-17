"use client"

import { useState, type FormEvent } from "react"

import { changePassword } from "@/lib/auth-client"
import {
  validateChangePasswordInput,
  type ChangePasswordErrors,
  type ChangePasswordField,
  type ChangePasswordValues,
} from "@/lib/validation/settings"

const initialValues: ChangePasswordValues = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
}

const initialVisibility: Record<ChangePasswordField, boolean> = {
  currentPassword: false,
  newPassword: false,
  confirmPassword: false,
}

type ProviderError = {
  code?: string
  error?: { code?: string }
  message?: string
}

const providerFieldErrors: Record<string, ChangePasswordErrors> = {
  INVALID_PASSWORD: {
    currentPassword: "Current password is incorrect",
  },
  PASSWORD_TOO_SHORT: {
    newPassword: "Password must be at least 8 characters",
  },
  PASSWORD_TOO_LONG: {
    newPassword: "Password must be at most 128 characters",
  },
}

function mapProviderError(error: ProviderError): ChangePasswordErrors {
  const code = error.code ?? error.error?.code
  const fieldError = code ? providerFieldErrors[code] : undefined

  return (
    fieldError ?? {
      form:
        error.message ?? "Unable to update your password. Please try again.",
    }
  )
}

export function useChangePassword() {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<ChangePasswordErrors>({})
  const [visibility, setVisibility] = useState(initialVisibility)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  function onChange(field: ChangePasswordField, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({
      ...current,
      [field]: undefined,
      form: undefined,
    }))
    setIsSuccess(false)
  }

  function toggleVisibility(field: ChangePasswordField) {
    setVisibility((current) => ({ ...current, [field]: !current[field] }))
  }

  async function onSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    setIsSuccess(false)

    const validationErrors = validateChangePasswordInput(values)
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors)
      return
    }

    setIsSubmitting(true)
    try {
      const result = await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        revokeOtherSessions: true,
      })

      if (result.error) {
        setErrors(mapProviderError(result.error))
        return
      }

      setValues(initialValues)
      setErrors({})
      setVisibility(initialVisibility)
      setIsSuccess(true)
    } catch {
      setErrors({
        form: "Unable to connect. Check your connection and try again.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    values,
    errors,
    visibility,
    isSubmitting,
    isSuccess,
    onChange,
    onSubmit,
    toggleVisibility,
  }
}
