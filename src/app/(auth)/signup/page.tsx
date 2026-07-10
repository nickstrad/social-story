"use client"

import { AuthForm } from "@/components/auth/AuthForm"
import { useAuthForm } from "@/hooks/useAuthForm"

export default function SignUpPage() {
  const form = useAuthForm("signup")
  return <AuthForm mode="signup" {...form} />
}
