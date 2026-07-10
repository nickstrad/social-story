"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { signOut } from "@/lib/auth-client"

export function useSignOut() {
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function handleSignOut() {
    setIsSigningOut(true)
    await signOut()
    router.push("/signin")
    router.refresh()
  }

  return { handleSignOut, isSigningOut }
}
