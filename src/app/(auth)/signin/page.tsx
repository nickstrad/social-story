"use client"

import { AuthForm } from "@/components/auth/AuthForm"
import { useAuthForm } from "@/hooks/useAuthForm"

export default function SignInPage() {
  const form = useAuthForm("signin")
  return <AuthForm mode="signin" {...form} />
}
