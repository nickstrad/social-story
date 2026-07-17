"use client"

import {
  CheckCircle2Icon,
  CircleAlertIcon,
  EyeIcon,
  EyeOffIcon,
  LockKeyholeIcon,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { useChangePassword } from "@/hooks/useChangePassword"
import type { ChangePasswordField } from "@/lib/validation/settings"

type PasswordFieldConfig = {
  autoComplete: "current-password" | "new-password"
  description?: string
  field: ChangePasswordField
  label: string
}

const passwordFields = [
  {
    field: "currentPassword",
    label: "Current password",
    autoComplete: "current-password",
  },
  {
    field: "newPassword",
    label: "New password",
    autoComplete: "new-password",
    description: "Use 8 to 128 characters.",
  },
  {
    field: "confirmPassword",
    label: "Confirm new password",
    autoComplete: "new-password",
  },
] as const satisfies readonly PasswordFieldConfig[]

type PasswordInputProps = {
  autoComplete: "current-password" | "new-password"
  description?: string
  disabled: boolean
  error?: string
  field: ChangePasswordField
  label: string
  onChange: (value: string) => void
  onToggleVisibility: () => void
  value: string
  visible: boolean
}

function PasswordInput({
  autoComplete,
  description,
  disabled,
  error,
  field,
  label,
  onChange,
  onToggleVisibility,
  value,
  visible,
}: PasswordInputProps) {
  const descriptionId = description ? `${field}-description` : undefined
  const errorId = error ? `${field}-error` : undefined
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ")
  const actionLabel = `${visible ? "Hide" : "Show"} ${label.toLowerCase()}`

  return (
    <Field data-invalid={Boolean(error)} data-disabled={disabled}>
      <FieldLabel htmlFor={field}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupInput
          id={field}
          name={field}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy || undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            disabled={disabled}
            aria-label={actionLabel}
            aria-pressed={visible}
            onClick={onToggleVisibility}
          >
            {visible ? <EyeOffIcon /> : <EyeIcon />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {description && (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      )}
      <FieldError id={errorId}>{error}</FieldError>
    </Field>
  )
}

export function ChangePasswordForm() {
  const form = useChangePassword()

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Change password</h2>
        </CardTitle>
        <CardDescription>
          Confirm your current password, then choose a new one. Other devices
          will be signed out for your security.
        </CardDescription>
        <CardAction
          aria-hidden="true"
          className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground"
        >
          <LockKeyholeIcon className="size-4" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.onSubmit} noValidate>
          <FieldGroup>
            {passwordFields.map(({ field, ...config }) => (
              <PasswordInput
                key={field}
                field={field}
                {...config}
                value={form.values[field]}
                error={form.errors[field]}
                visible={form.visibility[field]}
                disabled={form.isSubmitting}
                onChange={(value) => form.onChange(field, value)}
                onToggleVisibility={() => form.toggleVisibility(field)}
              />
            ))}

            {form.errors.form && (
              <Alert variant="destructive">
                <CircleAlertIcon />
                <AlertTitle>Password not updated</AlertTitle>
                <AlertDescription>{form.errors.form}</AlertDescription>
              </Alert>
            )}

            {form.isSuccess && (
              <Alert>
                <CheckCircle2Icon />
                <AlertTitle>Password updated</AlertTitle>
                <AlertDescription>
                  Your new password is active. Other devices have been signed
                  out.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={form.isSubmitting}>
                {form.isSubmitting && <Spinner />}
                Update password
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
