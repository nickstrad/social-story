"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { signOut } from "@/lib/auth-client"

export function useSignOut() {
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function handleSignOut() {
    setIsSigningOut(true)
    try {
      await signOut()
      router.push("/signin")
      router.refresh()
    } catch {
      // Keep the current session and let the user retry.
    } finally {
      setIsSigningOut(false)
    }
  }

  return { handleSignOut, isSigningOut }
}
