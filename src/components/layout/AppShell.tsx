"use client"

import { AppHeader } from "@/components/layout/AppHeader"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
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
    // The provider's default min-h-svh/row layout is replaced here: the header
    // owns the top strip and the sidebar+content row fills what's left.
    // --header-height is declared once, here, because two children have to
    // agree on it: the header sets its own height from it, and the sidebar —
    // which the shared component positions as `fixed inset-y-0` — offsets
    // itself below the header by it.
    <SidebarProvider
      className="min-h-0 flex-1 flex-col"
      style={{ "--header-height": "4rem" } as React.CSSProperties}
    >
      <AppHeader
        email={email}
        onSignOut={signOut.handleSignOut}
        isSigningOut={signOut.isSigningOut}
      />
      <div className="flex flex-1">
        <AppSidebar />
        {/* SidebarInset is itself the <main> landmark, so this is just the
            centered content column inside it. */}
        <SidebarInset>
          <div className="mx-auto w-full max-w-6xl flex-1 p-6">{children}</div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
