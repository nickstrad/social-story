import { z } from "zod"

export const emailSchema = z.email("Enter a valid email address")
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
export const nameSchema = z.string().trim().min(1, "Enter your name")

export type AuthMode = "signin" | "signup"
export type AuthValues = {
  name: string
  email: string
  password: string
  confirmPassword: string
}
export type AuthErrors = Partial<Record<keyof AuthValues | "form", string>>

export function validateAuthInput(
  values: AuthValues,
  mode: AuthMode
): AuthErrors {
  const base = z.object({
    name: mode === "signup" ? nameSchema : z.string(),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  const schema =
    mode === "signup"
      ? base.refine((v) => v.password === v.confirmPassword, {
          message: "Passwords do not match",
          path: ["confirmPassword"],
        })
      : base
  const result = schema.safeParse(values)

  if (result.success) return {}

  const fields = z.flattenError(result.error).fieldErrors
  return Object.fromEntries(
    Object.entries(fields).map(([field, messages]) => [field, messages?.[0]])
  ) as AuthErrors
}
