import { z } from "zod"

export const emailSchema = z.email("Enter a valid email address")
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
export const nameSchema = z.string().trim().min(1, "Enter your name")

export type AuthMode = "signin" | "signup"
export type AuthValues = { name: string; email: string; password: string }
export type AuthErrors = Partial<Record<keyof AuthValues | "form", string>>

export function validateAuthInput(
  values: AuthValues,
  mode: AuthMode
): AuthErrors {
  const schema = z.object({
    name: mode === "signup" ? nameSchema : z.string(),
    email: emailSchema,
    password: passwordSchema,
  })
  const result = schema.safeParse(values)

  if (result.success) return {}

  const fields = result.error.flatten().fieldErrors
  return Object.fromEntries(
    Object.entries(fields).map(([field, messages]) => [field, messages?.[0]])
  ) as AuthErrors
}
