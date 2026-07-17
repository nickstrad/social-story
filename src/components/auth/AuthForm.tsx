import Link from "next/link"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import type { AuthErrors, AuthMode, AuthValues } from "@/lib/validation/auth"

type AuthFormProps = {
  mode: AuthMode
  values: AuthValues
  errors: AuthErrors
  isSubmitting: boolean
  onChange: (field: keyof AuthValues, value: string) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}

export function AuthForm({
  mode,
  values,
  errors,
  isSubmitting,
  onChange,
  onSubmit,
}: AuthFormProps) {
  const isSignUp = mode === "signup"

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">
          {isSignUp ? "Create your account" : "Welcome back"}
        </CardTitle>
        <CardDescription>
          {isSignUp
            ? "Start creating personalized social stories."
            : "Sign in to continue your stories."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            {isSignUp && (
              <Field data-invalid={Boolean(errors.name)}>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input
                  id="name"
                  autoComplete="name"
                  value={values.name}
                  onChange={(event) => onChange("name", event.target.value)}
                  aria-invalid={Boolean(errors.name)}
                />
                <FieldError>{errors.name}</FieldError>
              </Field>
            )}
            <Field data-invalid={Boolean(errors.email)}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={values.email}
                onChange={(event) => onChange("email", event.target.value)}
                aria-invalid={Boolean(errors.email)}
              />
              <FieldError>{errors.email}</FieldError>
            </Field>
            <Field data-invalid={Boolean(errors.password)}>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                type="password"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                value={values.password}
                onChange={(event) => onChange("password", event.target.value)}
                aria-invalid={Boolean(errors.password)}
              />
              <FieldError>{errors.password}</FieldError>
            </Field>
            {isSignUp && (
              <Field data-invalid={Boolean(errors.confirmPassword)}>
                <FieldLabel htmlFor="confirmPassword">
                  Confirm password
                </FieldLabel>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={values.confirmPassword}
                  onChange={(event) =>
                    onChange("confirmPassword", event.target.value)
                  }
                  aria-invalid={Boolean(errors.confirmPassword)}
                />
                <FieldError>{errors.confirmPassword}</FieldError>
              </Field>
            )}
            {errors.form && (
              <Alert variant="destructive">
                <AlertDescription>{errors.form}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Spinner />}
              {isSignUp ? "Create account" : "Sign in"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {isSignUp ? "Already have an account?" : "New to Social Story?"}{" "}
              <Link
                className="font-medium text-foreground underline underline-offset-4"
                href={isSignUp ? "/signin" : "/signup"}
              >
                {isSignUp ? "Sign in" : "Create an account"}
              </Link>
            </p>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
