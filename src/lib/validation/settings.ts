import { z } from "zod"

import { passwordSchema } from "@/lib/validation/auth"

export type ChangePasswordValues = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export type ChangePasswordField = keyof ChangePasswordValues

export type ChangePasswordErrors = Partial<
  Record<ChangePasswordField | "form", string>
>

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .superRefine((values, context) => {
    if (values.newPassword === values.currentPassword) {
      context.addIssue({
        code: "custom",
        message: "Choose a password different from your current password",
        path: ["newPassword"],
      })
    }

    if (values.newPassword !== values.confirmPassword) {
      context.addIssue({
        code: "custom",
        message: "Passwords do not match",
        path: ["confirmPassword"],
      })
    }
  })

export function validateChangePasswordInput(
  values: ChangePasswordValues
): ChangePasswordErrors {
  const result = changePasswordSchema.safeParse(values)
  if (result.success) return {}

  const fields = z.flattenError(result.error).fieldErrors
  return Object.fromEntries(
    Object.entries(fields).map(([field, messages]) => [field, messages?.[0]])
  ) as ChangePasswordErrors
}
