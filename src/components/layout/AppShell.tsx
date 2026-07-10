"use client"

import { AppHeader } from "@/components/layout/AppHeader"
import { useSignOut } from "@/hooks/useSignOut"

export function AppShell({
  email,
  children,
}: {
  email: string
  children: React.ReactNode
}) {
  const signOut = useSignOut()
  return (
    <>
      <AppHeader
        email={email}
        onSignOut={signOut.handleSignOut}
        isSigningOut={signOut.isSigningOut}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 p-6">{children}</main>
    </>
  )
}
