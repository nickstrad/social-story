"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"

import { signIn, signUp } from "@/lib/auth-client"
import {
  validateAuthInput,
  type AuthErrors,
  type AuthMode,
  type AuthValues,
} from "@/lib/validation/auth"

const initialValues: AuthValues = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
}

function authenticate(values: AuthValues, mode: AuthMode) {
  return mode === "signup"
    ? signUp.email({
        name: values.name,
        email: values.email,
        password: values.password,
      })
    : signIn.email({ email: values.email, password: values.password })
}

export function useAuthForm(mode: AuthMode) {
  const router = useRouter()
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<AuthErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  function onChange(field: keyof AuthValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({
      ...current,
      [field]: undefined,
      form: undefined,
    }))
  }

  async function onSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    const validationErrors = validateAuthInput(values, mode)
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors)
      return
    }

    setIsSubmitting(true)
    try {
      const result = await authenticate(values, mode)
      if (result.error) {
        setErrors({ form: result.error.message ?? "Authentication failed" })
        return
      }

      router.push("/stories")
      router.refresh()
    } catch {
      setErrors({ form: "Unable to connect. Please try again." })
    } finally {
      setIsSubmitting(false)
    }
  }

  return { values, errors, isSubmitting, onChange, onSubmit }
}
