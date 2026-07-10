"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

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
      toast.error("Unable to sign out. Please try again.")
    } finally {
      setIsSigningOut(false)
    }
  }

  return { handleSignOut, isSigningOut }
}
